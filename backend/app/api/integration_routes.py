"""Rotas administrativas de diagnóstico da integração Protheus."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.admin_security import require_admin
from app.core.logging_config import get_correlation_id
from app.db.database import get_db
from app.schemas.integration import ConnectionTestResponse
from app.schemas.protheus_context import (
    DiagnosticStep,
    IntegrationErrorCode,
    ProtheusConnectionDiagnosticsResponse,
    ProtheusContext,
)
from app.services.protheus_integration_service import (
    IntegrationFailure,
    ProtheusIntegrationService,
)

logger = logging.getLogger("app.api.integration")
router = APIRouter(prefix="/integration", tags=["integration"])


def _correlation_id() -> str:
    current = get_correlation_id()
    return current if current and current != "-" else str(uuid.uuid4())


def _safe_error_response(exc: IntegrationFailure, correlation_id: str) -> dict:
    return {
        "success": False,
        "code": exc.code,
        "message": str(exc),
        "correlation_id": correlation_id,
        "status_code": exc.status_code,
        "retryable": exc.retryable,
    }


@router.get("/diagnostics", response_model=ProtheusConnectionDiagnosticsResponse)
async def integration_diagnostics(
    tenant_code: str = Query(..., min_length=1, max_length=100),
    environment_code: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
) -> ProtheusConnectionDiagnosticsResponse:
    """Valida conexão e QueryRest sem retornar ou persistir dados empresariais."""
    started = time.monotonic()
    correlation_id = _correlation_id()
    context = ProtheusContext(
        tenant_code=tenant_code,
        environment_code=environment_code,
    )
    service = ProtheusIntegrationService(db, context)
    authentication = DiagnosticStep(name="oauth2", status="running")
    queryrest = DiagnosticStep(name="queryrest", status="pending")
    dictionary = DiagnosticStep(name="dictionary", status="skipped", message="A sincronização de metadados é uma operação separada.")

    try:
        auth_started = time.monotonic()
        auth_status = await service.authenticate()
        authentication = DiagnosticStep(
            name="oauth2",
            status="passed",
            duration_ms=int((time.monotonic() - auth_started) * 1000),
            message="Token OAuth2 resolvido com segurança; o token não é retornado.",
        )

        query_started = time.monotonic()
        await service.execute_queryrest("SELECT 1 FROM DUAL", company_required=False)
        queryrest = DiagnosticStep(
            name="queryrest",
            status="passed",
            duration_ms=int((time.monotonic() - query_started) * 1000),
            message="QueryRest respondeu ao teste técnico sem retorno empresarial.",
        )
        return ProtheusConnectionDiagnosticsResponse(
            success=True,
            context=context,
            checked_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            correlation_id=correlation_id,
            connection_found=auth_status.connection_found,
            authentication=authentication,
            queryrest=queryrest,
            dictionary=dictionary,
            steps=[authentication, queryrest, dictionary],
        )
    except IntegrationFailure as exc:
        failed_step = authentication if authentication.status == "running" else queryrest
        failed_step = failed_step.model_copy(update={"status": "failed", "code": exc.code, "message": str(exc), "duration_ms": int((time.monotonic() - started) * 1000)})
        if authentication.status == "running":
            authentication = failed_step
        else:
            queryrest = failed_step
        raise HTTPException(
            status_code=exc.status_code,
            detail=_safe_error_response(exc, correlation_id),
        ) from exc
    except ValueError as exc:
        error = IntegrationFailure(IntegrationErrorCode.CONTEXT_INVALID, str(exc), 400)
        raise HTTPException(status_code=400, detail=_safe_error_response(error, correlation_id)) from exc
    except Exception as exc:
        logger.exception(
            "Falha inesperada no diagnóstico Protheus tenant=%s ambiente=%s correlation_id=%s",
            tenant_code,
            environment_code,
            correlation_id,
        )
        error = IntegrationFailure(
            IntegrationErrorCode.INTERNAL_ERROR,
            "Falha interna ao executar o diagnóstico da integração Protheus.",
            500,
        )
        raise HTTPException(status_code=500, detail=_safe_error_response(error, correlation_id)) from exc


@router.get("/test", response_model=ConnectionTestResponse)
async def test_connection(
    tenant_id: str = Query(..., min_length=1, max_length=100),
    environment_code: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_admin),
) -> ConnectionTestResponse:
    """Compatibilidade legada para o teste de conexão, agora protegido e sanitizado."""
    started = time.monotonic()
    correlation_id = _correlation_id()
    try:
        context = ProtheusContext(tenant_code=tenant_id, environment_code=environment_code)
        service = ProtheusIntegrationService(db, context)
        await service.authenticate()
        await service.execute_queryrest("SELECT 1 FROM DUAL", company_required=False)
        return ConnectionTestResponse(
            ok=True,
            tenant_id=tenant_id,
            tenant=tenant_id,
            auth_type="oauth2_password",
            http_method="POST",
            status_code=200,
            latency_ms=int((time.monotonic() - started) * 1000),
            message="Conexão OAuth2/QueryRest validada com sucesso.",
        )
    except IntegrationFailure as exc:
        logger.warning(
            "Teste de conexão falhou tenant=%s ambiente=%s code=%s correlation_id=%s",
            tenant_id,
            environment_code,
            exc.code,
            correlation_id,
        )
        return ConnectionTestResponse(
            ok=False,
            tenant_id=tenant_id,
            tenant=tenant_id,
            http_method="POST",
            status_code=exc.status_code,
            latency_ms=int((time.monotonic() - started) * 1000),
            message=str(exc),
            error=f"{exc.code} (correlation_id={correlation_id})",
        )
    except Exception:
        logger.exception(
            "Falha inesperada no teste de conexão tenant=%s ambiente=%s correlation_id=%s",
            tenant_id,
            environment_code,
            correlation_id,
        )
        return ConnectionTestResponse(
            ok=False,
            tenant_id=tenant_id,
            tenant=tenant_id,
            http_method="POST",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            latency_ms=int((time.monotonic() - started) * 1000),
            message="Serviço de integração Protheus indisponível.",
            error=f"INTERNAL_ERROR (correlation_id={correlation_id})",
        )

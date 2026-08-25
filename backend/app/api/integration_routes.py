"""Rotas de diagnóstico da integração REST Protheus.

O teste usa a mesma resolução OAuth2/QueryRest do fluxo operacional. Não aceita
URL, usuário, senha ou token fornecidos pelo cliente e nunca usa Basic Auth.
"""

from __future__ import annotations

import json
import logging
import time

from fastapi import APIRouter, Query

from app.schemas.integration import ConnectionTestResponse
from app.services.protheus_service import (
    ProtheusServiceError,
    execute_protheus_tool,
    get_tenant_config,
)

logger = logging.getLogger("app.api.integration")
router = APIRouter(prefix="/integration", tags=["integration"])


@router.get("/test", response_model=ConnectionTestResponse)
async def test_connection(
    tenant_id: str = Query(..., min_length=1, max_length=100),
    environment_code: str = Query(..., min_length=1, max_length=100),
) -> ConnectionTestResponse:
    """Testa a conexão do tenant/ambiente com uma consulta Oracle inofensiva."""
    started = time.monotonic()

    try:
        config = get_tenant_config(tenant_id, environment_code)
        raw_result = await execute_protheus_tool(
            "QueryRest",
            {"cQuery": "SELECT 1 FROM DUAL"},
            tenant_id=tenant_id,
            environment_code=environment_code,
        )

        parsed = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
        if isinstance(parsed, dict) and parsed.get("error"):
            status_code = parsed.get("status_code")
            return ConnectionTestResponse(
                ok=False,
                tenant_id=tenant_id,
                tenant=tenant_id,
                rest_url=config.get("rest_url"),
                auth_type=config.get("auth_mode"),
                http_method="POST",
                status_code=status_code,
                latency_ms=int((time.monotonic() - started) * 1000),
                message="O AppServer respondeu com erro ao teste QueryRest.",
                error=str(parsed.get("error")),
            )

        return ConnectionTestResponse(
            ok=True,
            tenant_id=tenant_id,
            tenant=tenant_id,
            rest_url=config.get("rest_url"),
            auth_type=config.get("auth_mode"),
            http_method="POST",
            status_code=200,
            latency_ms=int((time.monotonic() - started) * 1000),
            message="Conexão OAuth2/QueryRest validada com sucesso.",
        )
    except ProtheusServiceError as exc:
        logger.warning(
            "Teste de conexão falhou tenant=%s ambiente=%s status=%s",
            tenant_id,
            environment_code,
            exc.status_code,
        )
        return ConnectionTestResponse(
            ok=False,
            tenant_id=tenant_id,
            tenant=tenant_id,
            http_method="POST",
            status_code=exc.status_code,
            latency_ms=int((time.monotonic() - started) * 1000),
            message="Não foi possível validar a conexão Protheus.",
            error=str(exc),
        )
    except Exception as exc:
        logger.warning(
            "Falha inesperada no teste de conexão tenant=%s ambiente=%s tipo=%s",
            tenant_id,
            environment_code,
            type(exc).__name__,
        )
        return ConnectionTestResponse(
            ok=False,
            tenant_id=tenant_id,
            tenant=tenant_id,
            http_method="POST",
            status_code=502,
            latency_ms=int((time.monotonic() - started) * 1000),
            message="Serviço de integração Protheus indisponível.",
            error="Falha inesperada ao executar o teste de conexão.",
        )

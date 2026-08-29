"""Fachada única para operações Protheus com contexto explícito e retorno sanitizado."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping
from urllib.parse import urlparse

from app.schemas.protheus_context import IntegrationErrorCode, ProtheusContext
from app.services.protheus_queryrest_client import (
    ProtheusQueryRestClient,
    ProtheusQueryRestError,
)
from app.services.protheus_token_service import (
    ProtheusAuthError,
    get_valid_access_token,
    load_connection,
)


@dataclass(frozen=True)
class IntegrationFailure(RuntimeError):
    """Falha técnica sanitizada para ser convertida em resposta HTTP segura."""

    code: IntegrationErrorCode
    message: str
    status_code: int
    retryable: bool = False

    def __str__(self) -> str:
        return self.message


@dataclass(frozen=True)
class AuthenticationStatus:
    tenant_code: str
    environment_code: str
    connection_found: bool
    authenticated: bool
    token_expires_at: datetime | None


class ProtheusIntegrationService:
    """Ponto único de entrada para conexão e QueryRest, sem persistir dados do ERP."""

    def __init__(self, db: Any, context: ProtheusContext) -> None:
        self.db = db
        self.context = context
        self.tenant_code = context.tenant_code
        self.environment_code = context.environment_code

    def _context(self, *, company_required: bool = False) -> ProtheusContext:
        if company_required:
            self.context.require_company_scope()
        return self.context

    def _load_connection_or_failure(self) -> dict[str, Any]:
        try:
            connection = load_connection(self.db, self.tenant_code, self.environment_code)
        except ValueError as exc:
            raise IntegrationFailure(
                IntegrationErrorCode.CONNECTION_NOT_FOUND,
                "Conexão REST Protheus ativa não localizada para o tenant e ambiente informados.",
                404,
            ) from exc

        self._validate_base_url(connection.get("base_rest_url"))
        return connection

    @staticmethod
    def _validate_base_url(value: Any) -> str:
        base_url = str(value or "").strip().rstrip("/")
        parsed = urlparse(base_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise IntegrationFailure(
                IntegrationErrorCode.CONTEXT_INVALID,
                "A URL REST Protheus deve usar HTTPS e informar um host válido.",
                400,
            )
        path = parsed.path.rstrip("/").lower()
        if path.endswith("/queryrest") or path.endswith("/api/oauth2/v1/token"):
            raise IntegrationFailure(
                IntegrationErrorCode.CONTEXT_INVALID,
                "Informe somente a URL base terminada em /rest; não inclua QueryRest ou o endpoint de token.",
                400,
            )
        if not path.endswith("/rest"):
            raise IntegrationFailure(
                IntegrationErrorCode.CONTEXT_INVALID,
                "A URL REST Protheus deve terminar em /rest.",
                400,
            )
        return base_url

    async def authenticate(self) -> AuthenticationStatus:
        connection = self._load_connection_or_failure()
        try:
            await get_valid_access_token(
                self.db,
                self.tenant_code,
                self.environment_code,
            )
        except ProtheusAuthError as exc:
            status_code = exc.status_code if 400 <= exc.status_code <= 599 else 502
            code = (
                IntegrationErrorCode.PROTHEUS_UNAVAILABLE
                if status_code in {408, 429, 500, 502, 503, 504}
                else IntegrationErrorCode.PROTHEUS_AUTH_FAILED
            )
            raise IntegrationFailure(
                code,
                "Não foi possível autenticar no Protheus. Verifique a conexão e as credenciais configuradas.",
                status_code,
                retryable=code == IntegrationErrorCode.PROTHEUS_UNAVAILABLE,
            ) from exc
        except TimeoutError as exc:
            raise IntegrationFailure(
                IntegrationErrorCode.PROTHEUS_TIMEOUT,
                "A autenticação no Protheus excedeu o tempo limite.",
                504,
                retryable=True,
            ) from exc
        except Exception as exc:
            raise IntegrationFailure(
                IntegrationErrorCode.PROTHEUS_UNAVAILABLE,
                "Não foi possível alcançar o serviço de autenticação do Protheus.",
                502,
                retryable=True,
            ) from exc

        refreshed = load_connection(self.db, self.tenant_code, self.environment_code)
        return AuthenticationStatus(
            tenant_code=self.tenant_code,
            environment_code=self.environment_code,
            connection_found=True,
            authenticated=True,
            token_expires_at=refreshed.get("access_token_expires_at"),
        )

    async def execute_queryrest(
        self,
        query: str,
        *,
        payload: Mapping[str, Any] | None = None,
        company_required: bool = True,
    ) -> Any:
        self._context(company_required=company_required)
        if not str(query or "").strip():
            raise IntegrationFailure(
                IntegrationErrorCode.CONTEXT_INVALID,
                "A consulta QueryRest não pode ser vazia.",
                400,
            )

        try:
            client = ProtheusQueryRestClient(
                self.db,
                self.tenant_code,
                self.environment_code,
            )
            return await client.execute(query, payload=payload)
        except ProtheusQueryRestError as exc:
            status_code = exc.status_code if exc.status_code and 400 <= exc.status_code <= 599 else 502
            if status_code == 403:
                code = IntegrationErrorCode.QUERYREST_REJECTED
                message = "O Protheus recusou a execução da consulta QueryRest."
                retryable = False
            elif status_code in {408, 429, 500, 502, 503, 504}:
                code = IntegrationErrorCode.PROTHEUS_UNAVAILABLE
                message = "O serviço QueryRest do Protheus está indisponível ou sobrecarregado."
                retryable = True
            else:
                code = IntegrationErrorCode.QUERYREST_REJECTED
                message = "O Protheus rejeitou a consulta QueryRest."
                retryable = False
            raise IntegrationFailure(code, message, status_code, retryable) from exc
        except TimeoutError as exc:
            raise IntegrationFailure(
                IntegrationErrorCode.PROTHEUS_TIMEOUT,
                "A execução do QueryRest excedeu o tempo limite.",
                504,
                retryable=True,
            ) from exc


__all__ = [
    "AuthenticationStatus",
    "IntegrationFailure",
    "ProtheusIntegrationService",
]

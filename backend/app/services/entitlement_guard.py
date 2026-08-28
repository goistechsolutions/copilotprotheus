"""Guard de licenciamento e autorização do Copilot por tenant e ambiente.

O serviço é deliberadamente fail-closed quando `ENTITLEMENT_GUARD_MODE=enforce`.
O modo padrão `shadow` registra divergências sem bloquear o rollout inicial.
Nenhuma consulta desta classe lê dados operacionais do ERP; ela consulta somente
as tabelas de controle do Copilot e as permissões do snapshot do tenant.
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from sqlalchemy import text

from app.services.protheus_module_catalog import quote_tenant_schema

logger = logging.getLogger("app.services.entitlement_guard")

_INVALID_CONTEXT = {"", "default", "none", "null", "public"}
_ACTIVE_CONTRACT_STATUSES = {"active", "enabled", "allowed"}
_ALLOWED_OVERAGE_MODES = {"block", "allow", "charge", "overage"}


class EntitlementDenied(Exception):
    """Bloqueio de entitlement sem incluir SQL, tokens ou dados corporativos."""

    def __init__(self, code: str, message: str, *, status_code: int = 403):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message}


@dataclass
class EntitlementDecision:
    allowed: bool
    mode: str
    tenant_code: str
    environment_code: str
    module_code: str
    contract_id: str | None = None
    contract_code: str | None = None
    plan_code: str | None = None
    query_limit: int | None = None
    queries_used: int | None = None
    remaining_queries: int | None = None
    overage_mode: str = "block"
    concurrent_sessions_limit: int | None = None
    active_sessions: int | None = None
    user_id: str | None = None
    role_id: str | None = None
    issues: list[dict[str, str]] = field(default_factory=list)
    lease_key: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "mode": self.mode,
            "tenant_code": self.tenant_code,
            "environment_code": self.environment_code,
            "module_code": self.module_code,
            "contract_id": self.contract_id,
            "contract_code": self.contract_code,
            "plan_code": self.plan_code,
            "query_limit": self.query_limit,
            "queries_used": self.queries_used,
            "remaining_queries": self.remaining_queries,
            "overage_mode": self.overage_mode,
            "concurrent_sessions_limit": self.concurrent_sessions_limit,
            "active_sessions": self.active_sessions,
            "user_id": self.user_id,
            "role_id": self.role_id,
            "issues": list(self.issues),
            "lease_key": self.lease_key,
        }


@dataclass
class DictionaryAuthorization:
    allowed_tables: set[str] = field(default_factory=set)
    allowed_fields_by_table: dict[str, set[str]] = field(default_factory=dict)
    filter_fields_by_table: dict[str, set[str]] = field(default_factory=dict)
    masked_fields_by_table: dict[str, set[str]] = field(default_factory=dict)


class EntitlementGuard:
    """Valida os direitos contratados antes da geração/execução de uma consulta."""

    def __init__(self, mode: str | None = None, session_ttl_seconds: int | None = None):
        configured_mode = str(mode or os.getenv("ENTITLEMENT_GUARD_MODE", "shadow")).strip().lower()
        self.mode = configured_mode if configured_mode in {"off", "shadow", "enforce"} else "shadow"
        configured_ttl = session_ttl_seconds or int(os.getenv("ENTITLEMENT_SESSION_TTL_SECONDS", "900"))
        self.session_ttl_seconds = max(60, min(configured_ttl, 86_400))

    @staticmethod
    def _clean(value: Any) -> str:
        return str(value or "").strip()

    @staticmethod
    def _lower(value: Any) -> str:
        return EntitlementGuard._clean(value).lower()

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _table_tokens(value: Any) -> set[str]:
        token = str(value or "").strip().upper()
        if not token:
            return set()
        tokens = {token}
        if len(token) == 3:
            tokens.add(f"{token}010")
        elif token.endswith("010") and len(token) > 3:
            tokens.add(token[:-3])
        return tokens

    @staticmethod
    def _schema_table_exists(db: Any, schema_name: str, table_name: str) -> bool:
        result = db.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = :schema_name
                      AND table_name = :table_name
                ) AS exists_flag
            """),
            {"schema_name": schema_name, "table_name": table_name},
        )
        scalar = getattr(result, "scalar", None)
        if not callable(scalar):
            return False
        return bool(scalar())

    def _issue(self, decision: EntitlementDecision, code: str, message: str) -> None:
        decision.issues.append({"code": code, "message": message})
        decision.allowed = False

    def _load_contract(self, db: Any, tenant_code: str) -> Mapping[str, Any] | None:
        return db.execute(
            text("""
                SELECT
                    tc.id::text AS contract_id,
                    tc.contract_code,
                    tc.tenant_id,
                    tc.contract_status,
                    tc.starts_at,
                    tc.ends_at,
                    COALESCE(tc.query_limit_override, lp.query_limit) AS query_limit,
                    COALESCE(
                        tc.concurrent_sessions_override,
                        lp.concurrent_sessions_limit
                    ) AS concurrent_sessions_limit,
                    COALESCE(tc.overage_mode_override, lp.overage_mode, 'block') AS overage_mode,
                    lp.plan_code
                FROM public.tenant_contracts tc
                LEFT JOIN public.license_plans lp ON lp.id = tc.plan_id
                WHERE lower(btrim(tc.tenant_id)) = :tenant_code
                  AND lower(btrim(tc.contract_status)) IN ('active', 'enabled', 'allowed')
                  AND tc.starts_at <= CURRENT_DATE
                  AND (tc.ends_at IS NULL OR tc.ends_at >= CURRENT_DATE)
                ORDER BY tc.starts_at DESC, tc.created_at DESC NULLS LAST
                LIMIT 1
            """),
            {"tenant_code": tenant_code.lower()},
        ).mappings().first()

    def _load_user(
        self,
        db: Any,
        tenant_code: str,
        user_identity: str | None,
    ) -> Mapping[str, Any] | None:
        identity = self._clean(user_identity)
        if not identity:
            return None
        return db.execute(
            text("""
                SELECT id::text AS user_id, email, role_id::text AS role_id, status
                FROM public.users
                WHERE lower(btrim(COALESCE(tenant_id, ''))) = :tenant_code
                  AND lower(btrim(status)) = 'active'
                  AND (
                        id::text = :identity
                     OR lower(btrim(email)) = lower(:identity)
                     OR lower(btrim(full_name)) = lower(:identity)
                  )
                LIMIT 1
            """),
            {"tenant_code": tenant_code.lower(), "identity": identity},
        ).mappings().first()

    def _load_module_contract(
        self,
        db: Any,
        tenant_code: str,
        contract_id: str,
        module_code: str,
    ) -> Mapping[str, Any] | None:
        token = self._clean(module_code).upper()
        return db.execute(
            text("""
                SELECT
                    tmc.module_id::text AS module_id,
                    pm.mod_code::text AS mod_code,
                    pm.mod_sigla,
                    pm.mod_name,
                    tmc.status
                FROM public.tenant_module_contracts tmc
                JOIN public.protheus_modules_master pm ON pm.id = tmc.module_id
                WHERE lower(btrim(tmc.tenant_id)) = :tenant_code
                  AND tmc.contract_id::text = :contract_id
                  AND lower(btrim(tmc.status)) IN ('active', 'enabled', 'allowed')
                  AND pm.active = TRUE
                  AND (
                        pm.mod_code::text = :token
                     OR upper(btrim(COALESCE(pm.mod_sigla, ''))) = :token
                     OR upper(btrim(COALESCE(pm.mod_sigla, ''))) = 'SIGA' || :token
                     OR upper(COALESCE(pm.mod_name, '')) LIKE '%' || :token || '%'
                  )
                LIMIT 1
            """),
            {"tenant_code": tenant_code.lower(), "contract_id": contract_id, "token": token},
        ).mappings().first()

    def _lock_usage(self, db: Any, lock_key: str) -> None:
        dialect = getattr(getattr(db, "bind", None), "dialect", None)
        if getattr(dialect, "name", None) == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"), {"lock_key": lock_key})

    def _reserve_query(
        self,
        db: Any,
        decision: EntitlementDecision,
        correlation_id: str,
    ) -> None:
        if not decision.contract_id:
            return
        self._lock_usage(
            db,
            f"copilot:usage:{decision.tenant_code}:{decision.contract_id}",
        )
        period_ref = db.execute(text("SELECT to_char(CURRENT_DATE, 'YYYY-MM')")).scalar() or "current"
        row = db.execute(
            text("""
                SELECT total_queries, blocked_queries, overage_queries
                FROM public.query_usage_counters
                WHERE lower(btrim(tenant_id)) = :tenant_code
                  AND contract_id::text = :contract_id
                  AND period_ref = :period_ref
                FOR UPDATE
            """),
            {
                "tenant_code": decision.tenant_code.lower(),
                "contract_id": decision.contract_id,
                "period_ref": period_ref,
            },
        ).mappings().first()
        used = int((row or {}).get("total_queries") or 0)
        limit = decision.query_limit
        mode = decision.overage_mode if decision.overage_mode in _ALLOWED_OVERAGE_MODES else "block"
        if limit is not None and used >= limit and mode == "block":
            if row:
                db.execute(
                    text("""
                        UPDATE public.query_usage_counters
                        SET blocked_queries = blocked_queries + 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE lower(btrim(tenant_id)) = :tenant_code
                          AND contract_id::text = :contract_id
                          AND period_ref = :period_ref
                    """),
                    {
                        "tenant_code": decision.tenant_code.lower(),
                        "contract_id": decision.contract_id,
                        "period_ref": period_ref,
                    },
                )
            else:
                db.execute(
                    text("""
                        INSERT INTO public.query_usage_counters
                            (tenant_id, contract_id, period_ref, total_queries, blocked_queries, overage_queries, updated_at)
                        VALUES (:tenant_code, :contract_id, :period_ref, 0, 1, 0, CURRENT_TIMESTAMP)
                    """),
                    {
                        "tenant_code": decision.tenant_code,
                        "contract_id": decision.contract_id,
                        "period_ref": period_ref,
                    },
                )
            db.commit()
            decision.queries_used = used
            decision.remaining_queries = 0
            raise EntitlementDenied(
                "QUERY_LIMIT_EXCEEDED",
                "Limite de consultas contratado atingido para este período.",
                status_code=429,
            )

        if row:
            db.execute(
                text("""
                    UPDATE public.query_usage_counters
                    SET total_queries = total_queries + 1,
                        overage_queries = overage_queries + :overage_increment,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE lower(btrim(tenant_id)) = :tenant_code
                      AND contract_id::text = :contract_id
                      AND period_ref = :period_ref
                """),
                {
                    "tenant_code": decision.tenant_code.lower(),
                    "contract_id": decision.contract_id,
                    "period_ref": period_ref,
                    "overage_increment": 1 if limit is not None and used >= limit else 0,
                },
            )
        else:
            db.execute(
                text("""
                    INSERT INTO public.query_usage_counters
                        (tenant_id, contract_id, period_ref, total_queries, blocked_queries, overage_queries, updated_at)
                    VALUES (:tenant_code, :contract_id, :period_ref, 1, 0, :overage_increment, CURRENT_TIMESTAMP)
                """),
                {
                    "tenant_code": decision.tenant_code,
                    "contract_id": decision.contract_id,
                    "period_ref": period_ref,
                    "overage_increment": 1 if limit is not None and used >= limit else 0,
                },
            )
        db.commit()
        decision.queries_used = used + 1
        decision.remaining_queries = max(limit - used - 1, 0) if limit is not None else None
        if limit is not None and used >= limit:
            decision.overage_mode = mode

    def _acquire_session(
        self,
        db: Any,
        decision: EntitlementDecision,
        session_key: str,
        user_id: str | None,
    ) -> None:
        limit = decision.concurrent_sessions_limit
        if not limit or limit < 1:
            return
        key = self._clean(session_key)[:120]
        if not key:
            key = str(uuid.uuid4())
        decision.lease_key = key
        self._lock_usage(db, f"copilot:sessions:{decision.tenant_code}")
        db.execute(
            text("""
                UPDATE public.concurrent_sessions
                SET session_status = 'expired'
                WHERE lower(btrim(tenant_id)) = :tenant_code
                  AND session_status = 'active'
                  AND expires_at IS NOT NULL
                  AND expires_at <= CURRENT_TIMESTAMP
            """),
            {"tenant_code": decision.tenant_code.lower()},
        )
        existing = db.execute(
            text("""
                SELECT id
                FROM public.concurrent_sessions
                WHERE session_key = :session_key
                  AND lower(btrim(tenant_id)) = :tenant_code
                LIMIT 1
            """),
            {"session_key": key, "tenant_code": decision.tenant_code.lower()},
        ).scalar()
        active_count = db.execute(
            text("""
                SELECT COUNT(*)
                FROM public.concurrent_sessions
                WHERE lower(btrim(tenant_id)) = :tenant_code
                  AND session_status = 'active'
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """),
            {"tenant_code": decision.tenant_code.lower()},
        ).scalar() or 0
        if existing is None and int(active_count) >= limit:
            decision.active_sessions = int(active_count)
            db.commit()
            raise EntitlementDenied(
                "CONCURRENT_SESSION_LIMIT_EXCEEDED",
                "Limite de conexões simultâneas contratado atingido.",
                status_code=429,
            )

        if existing:
            db.execute(
                text("""
                    UPDATE public.concurrent_sessions
                    SET user_id = :user_id,
                        expires_at = CURRENT_TIMESTAMP + (:ttl_seconds * INTERVAL '1 second'),
                        session_status = 'active'
                    WHERE id = :session_id
                """),
                {"user_id": user_id, "ttl_seconds": self.session_ttl_seconds, "session_id": existing},
            )
        else:
            db.execute(
                text("""
                    INSERT INTO public.concurrent_sessions
                        (tenant_id, user_id, session_key, started_at, expires_at, session_status)
                    VALUES
                        (:tenant_code, :user_id, :session_key, CURRENT_TIMESTAMP,
                         CURRENT_TIMESTAMP + (:ttl_seconds * INTERVAL '1 second'), 'active')
                """),
                {
                    "tenant_code": decision.tenant_code,
                    "user_id": user_id,
                    "session_key": key,
                    "ttl_seconds": self.session_ttl_seconds,
                },
            )
        decision.active_sessions = int(active_count) + (0 if existing else 1)
        db.commit()

    def release_session(self, db: Any, tenant_code: str, session_key: str | None) -> None:
        key = self._clean(session_key)
        if not key:
            return
        db.execute(
            text("""
                UPDATE public.concurrent_sessions
                SET session_status = 'released', expires_at = CURRENT_TIMESTAMP
                WHERE lower(btrim(tenant_id)) = :tenant_code
                  AND session_key = :session_key
                  AND session_status = 'active'
            """),
            {"tenant_code": self._lower(tenant_code), "session_key": key[:120]},
        )
        db.commit()

    def _audit(self, db: Any, decision: EntitlementDecision, correlation_id: str, action: str) -> None:
        try:
            db.execute(
                text("""
                    INSERT INTO public.audit_logs
                        (tenant_id, user_id, module_name, action_name, target_type, request_id, details_json)
                    VALUES
                        (:tenant_id, :user_id, :module_name, :action_name, 'entitlement', :request_id, CAST(:details AS jsonb))
                """),
                {
                    "tenant_id": decision.tenant_code,
                    "user_id": decision.user_id,
                    "module_name": decision.module_code[:80],
                    "action_name": action[:120],
                    "request_id": correlation_id[:120],
                    "details": __import__("json").dumps({
                        "mode": decision.mode,
                        "allowed": decision.allowed,
                        "contract_id": decision.contract_id,
                        "plan_code": decision.plan_code,
                        "query_limit": decision.query_limit,
                        "queries_used": decision.queries_used,
                        "remaining_queries": decision.remaining_queries,
                        "overage_mode": decision.overage_mode,
                        "active_sessions": decision.active_sessions,
                        "issues": decision.issues,
                    }),
                },
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.warning("entitlement_audit_write_failed tenant=%s correlation_id=%s", decision.tenant_code, correlation_id)

    def evaluate(
        self,
        db: Any,
        *,
        tenant_code: str,
        environment_code: str,
        module_code: str,
        user_identity: str | None = None,
        role_id: str | None = None,
    ) -> EntitlementDecision:
        tenant = self._lower(tenant_code)
        environment = self._clean(environment_code)
        module = self._clean(module_code)
        decision = EntitlementDecision(
            allowed=True,
            mode=self.mode,
            tenant_code=tenant,
            environment_code=environment,
            module_code=module,
            user_id=self._clean(user_identity) or None,
            role_id=self._clean(role_id) or None,
        )
        if self.mode == "off":
            return decision
        if tenant in _INVALID_CONTEXT:
            self._issue(decision, "TENANT_REQUIRED", "Tenant real é obrigatório.")
            return decision
        if self._lower(environment) in _INVALID_CONTEXT:
            self._issue(decision, "ENVIRONMENT_REQUIRED", "Ambiente real é obrigatório.")
            return decision
        if not module:
            self._issue(decision, "MODULE_REQUIRED", "Módulo Protheus é obrigatório.")
            return decision

        tenant_row = db.execute(
            text("""
                SELECT schema_name
                FROM public.tenant
                WHERE lower(btrim(tenant_code)) = :tenant_code
                  AND status = 'active'
                LIMIT 1
            """),
            {"tenant_code": tenant},
        ).mappings().first()
        if not tenant_row:
            self._issue(decision, "TENANT_NOT_ACTIVE", "Tenant não está ativo.")
            return decision

        try:
            contract = self._load_contract(db, tenant)
        except Exception as exc:
            logger.exception("entitlement_contract_lookup_failed tenant=%s", tenant)
            self._issue(decision, "ENTITLEMENT_SCHEMA_ERROR", "Não foi possível validar o contrato do tenant.")
            return decision
        if not contract:
            self._issue(decision, "LICENSE_NOT_ACTIVE", "Não existe licença contratual ativa para o tenant.")
            return decision

        decision.contract_id = self._clean(contract.get("contract_id")) or None
        decision.contract_code = self._clean(contract.get("contract_code")) or None
        decision.plan_code = self._clean(contract.get("plan_code")) or None
        decision.query_limit = self._safe_int(contract.get("query_limit"))
        decision.concurrent_sessions_limit = self._safe_int(contract.get("concurrent_sessions_limit"))
        overage_mode = self._lower(contract.get("overage_mode"))
        decision.overage_mode = overage_mode if overage_mode in _ALLOWED_OVERAGE_MODES else "block"

        try:
            user = self._load_user(db, tenant, user_identity)
        except Exception:
            logger.exception("entitlement_user_lookup_failed tenant=%s", tenant)
            self._issue(decision, "ENTITLEMENT_SCHEMA_ERROR", "Não foi possível validar o usuário do tenant.")
            return decision
        if not user:
            self._issue(decision, "USER_NOT_ENTITLED", "Usuário não localizado ou inativo no tenant.")
        else:
            decision.user_id = self._clean(user.get("user_id")) or decision.user_id
            if not decision.role_id:
                decision.role_id = self._clean(user.get("role_id")) or None
        if self.mode == "enforce" and not decision.role_id:
            self._issue(decision, "ROLE_REQUIRED", "Perfil de acesso não informado para o usuário.")

        try:
            module = self._load_module_contract(db, tenant, decision.contract_id or "", module)
        except Exception:
            logger.exception("entitlement_module_lookup_failed tenant=%s", tenant)
            self._issue(decision, "ENTITLEMENT_SCHEMA_ERROR", "Não foi possível validar o módulo contratado.")
            return decision
        if not module:
            self._issue(decision, "MODULE_NOT_ENTITLED", "Módulo não está contratado para este tenant.")

        return decision

    def _handle_denial(
        self,
        db: Any,
        decision: EntitlementDecision,
        correlation_id: str,
    ) -> EntitlementDecision:
        if decision.allowed:
            return decision
        logger.warning(
            "entitlement_denied mode=%s tenant=%s environment=%s module=%s codes=%s correlation_id=%s",
            self.mode,
            decision.tenant_code,
            decision.environment_code,
            decision.module_code,
            ",".join(issue["code"] for issue in decision.issues),
            correlation_id,
        )
        if self.mode == "enforce":
            self._audit(db, decision, correlation_id, "entitlement_denied")
            issue = decision.issues[0]
            status_code = 429 if issue["code"] in {"QUERY_LIMIT_EXCEEDED", "CONCURRENT_SESSION_LIMIT_EXCEEDED"} else 403
            raise EntitlementDenied(issue["code"], issue["message"], status_code=status_code)
        return decision

    def authorize(
        self,
        db: Any,
        *,
        tenant_code: str,
        environment_code: str,
        module_code: str,
        user_identity: str | None = None,
        role_id: str | None = None,
        correlation_id: str = "",
    ) -> EntitlementDecision:
        """Avalia direitos sem consumir franquia nem abrir lease de sessão."""
        if self.mode == "off":
            return EntitlementDecision(
                allowed=True,
                mode="off",
                tenant_code=self._lower(tenant_code),
                environment_code=self._clean(environment_code),
                module_code=self._clean(module_code),
            )
        decision = self.evaluate(
            db,
            tenant_code=tenant_code,
            environment_code=environment_code,
            module_code=module_code,
            user_identity=user_identity,
            role_id=role_id,
        )
        return self._handle_denial(db, decision, correlation_id)

    def reserve(
        self,
        db: Any,
        decision: EntitlementDecision,
        *,
        session_key: str | None = None,
        correlation_id: str = "",
    ) -> EntitlementDecision:
        """Reserva consulta e conexão imediatamente antes da execução no Protheus.

        A reserva de consulta representa uma tentativa autorizada. Se o QueryRest
        falhar depois dessa etapa, o uso permanece contabilizado para auditoria;
        não há reembolso implícito de franquia.
        """
        if self.mode != "enforce":
            return decision
        self._handle_denial(db, decision, correlation_id)
        self._reserve_query(db, decision, correlation_id)
        self._acquire_session(db, decision, session_key or correlation_id, decision.user_id)
        self._audit(db, decision, correlation_id, "entitlement_reserved")
        return decision

    def check_and_reserve(
        self,
        db: Any,
        *,
        tenant_code: str,
        environment_code: str,
        module_code: str,
        user_identity: str | None = None,
        role_id: str | None = None,
        session_key: str | None = None,
        correlation_id: str = "",
    ) -> EntitlementDecision:
        """Compatibilidade para chamadores legados que ainda precisam dos dois passos."""
        decision = self.authorize(
            db,
            tenant_code=tenant_code,
            environment_code=environment_code,
            module_code=module_code,
            user_identity=user_identity,
            role_id=role_id,
            correlation_id=correlation_id,
        )
        return self.reserve(
            db,
            decision,
            session_key=session_key,
            correlation_id=correlation_id,
        )

    def authorize_dictionary_details(
        self,
        db: Any,
        *,
        tenant_schema: str,
        tenant_code: str,
        environment_code: str,
        company_id: int | str | None,
        role_id: str | None,
        table_names: Iterable[str],
        catalog_fields_by_table: Mapping[str, Iterable[str]] | None = None,
    ) -> DictionaryAuthorization:
        """Autoriza o catálogo importado e aplica restrições específicas de campo.

        O catálogo do tenant é a fonte de escopo: uma tabela/campo presente em
        ``dictionary_tables``/``dictionary_fields`` foi importada pelos módulos
        contratados e pode ser consultada. ``tenant_field_permissions`` é uma
        camada opcional de restrição, filtro e mascaramento. A tabela legada
        ``tenant_table_permissions`` não é requisito para autorizar o catálogo.
        """
        names: set[str] = set()
        for value in table_names:
            names.update(self._table_tokens(value))
        if not names:
            return DictionaryAuthorization()

        allowed_tables = set(names)
        authorization = DictionaryAuthorization(allowed_tables=allowed_tables)
        for table_name, fields in (catalog_fields_by_table or {}).items():
            normalized_tables = self._table_tokens(table_name) & allowed_tables
            for normalized_table in normalized_tables:
                authorization.allowed_fields_by_table.setdefault(normalized_table, set()).update(
                    self._clean(field).upper()
                    for field in (fields or [])
                    if self._clean(field)
                )

        schema_name = self._clean(tenant_schema).lower()
        schema = quote_tenant_schema(schema_name)
        params = {
            "tenant_code": self._lower(tenant_code),
            "environment_code": self._clean(environment_code),
            "role_id": self._clean(role_id),
            "company_id": self._clean(company_id),
        }
        role_match = """
                  AND (
                        btrim(role_id) = :role_id
                     OR lower(btrim(role_id)) = lower(btrim((
                            SELECT role_code
                            FROM public.roles
                            WHERE id::text = :role_id
                            LIMIT 1
                        )))
                  )
        """

        # Permissões de campo são opcionais. Quando presentes, podem restringir
        # a seleção do catálogo e definir filtro/mascaramento por papel.
        if self._schema_table_exists(db, schema_name, "tenant_field_permissions") and role_id:
            field_rows = db.execute(
                text(f"""
                    SELECT table_name, field_name, can_select, can_filter, masked_flag
                    FROM {schema}.tenant_field_permissions
                    WHERE lower(btrim(tenant_id)) = :tenant_code
                      AND environment_id = :environment_code
                      {role_match}
                      AND (company_id IS NULL OR company_id::text = :company_id)
                """),
                params,
            ).mappings().all()
            for row in field_rows:
                table_name = self._clean(row.get("table_name")).upper()
                field_name = self._clean(row.get("field_name")).upper()
                normalized_tables = self._table_tokens(table_name) & allowed_tables
                if not normalized_tables or not field_name:
                    continue
                for normalized_table in normalized_tables:
                    field_set = authorization.allowed_fields_by_table.setdefault(normalized_table, set())
                    if row.get("can_select") is False:
                        field_set.discard(field_name)
                    elif bool(row.get("can_select")):
                        field_set.add(field_name)
                    if bool(row.get("can_filter")):
                        authorization.filter_fields_by_table.setdefault(normalized_table, set()).add(field_name)
                    if bool(row.get("can_select")) and bool(row.get("masked_flag")):
                        authorization.masked_fields_by_table.setdefault(normalized_table, set()).add(field_name)
        return authorization

    def authorize_dictionary(
        self,
        db: Any,
        *,
        tenant_schema: str,
        tenant_code: str,
        environment_code: str,
        company_id: int | str | None,
        role_id: str | None,
        table_names: Iterable[str],
    ) -> tuple[set[str], dict[str, set[str]]]:
        """Compatibilidade: retorna apenas tabelas e campos selecionáveis."""
        authorization = self.authorize_dictionary_details(
            db,
            tenant_schema=tenant_schema,
            tenant_code=tenant_code,
            environment_code=environment_code,
            company_id=company_id,
            role_id=role_id,
            table_names=table_names,
        )
        return authorization.allowed_tables, authorization.allowed_fields_by_table

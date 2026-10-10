from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping

from sqlalchemy import text

from app.services.protheus_module_catalog import (
    quote_tenant_schema,
    require_tenant_module,
)

_TENANT_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")

_BLOCKED_TENANTS = {
    "public",
    "pg_catalog",
    "information_schema",
    "root",
    "admin",
}


@dataclass(frozen=True)
class ProtheusContext:
    tenant_id: str
    schema_name: str
    company_id: int | str
    company_code: str | None
    branch: str
    module_code: str
    module_sigla: str
    module_name: str | None
    user: str | None
    profile: str | None


def clean_tenant_id(value: str | None) -> str:
    if not value or not str(value).strip():
        raise ValueError("tenant_id é obrigatório")

    tenant_id = str(value).strip().lower()

    if not _TENANT_PATTERN.fullmatch(tenant_id):
        raise ValueError("tenant_id inválido")

    if tenant_id in _BLOCKED_TENANTS:
        raise ValueError("tenant_id reservado")

    return tenant_id


def resolve_tenant_schema(db: Any, tenant_id: str) -> str:
    row = db.execute(
        text("""
            SELECT schema_name
            FROM public.tenants
            WHERE (id::text = :tenant_id OR LOWER(tenant_code) = LOWER(:tenant_id) OR LOWER(schema_name) = LOWER(:tenant_id))
              AND UPPER(status) = 'ACTIVE'
            LIMIT 1
        """),
        {"tenant_id": tenant_id},
    ).mappings().first()

    if not row or not row.get("schema_name"):
        raise ValueError("tenant ativo não localizado")

    schema_name = str(row["schema_name"])

    quote_tenant_schema(schema_name)

    return schema_name


def resolve_company(
    db: Any,
    schema_name: str,
    company_id: int | str | None,
    company_code: str | None,
    branch: str | None,
) -> Mapping[str, Any] | None:
    schema = quote_tenant_schema(schema_name)

    # 1. Tenta {schema}.company_info (mantendo contrato e testes unitarios legados)
    try:
        if company_id not in (None, ""):
            row = db.execute(
                text(f"""
                    SELECT *
                    FROM {schema}.company_info
                    WHERE (id::text = :company_id OR company_code = :company_id)
                      AND LOWER(status) IN ('active', 'ativa')
                    LIMIT 1
                """),
                {"company_id": str(company_id)},
            ).mappings().first()
            return dict(row) if row else None

        if company_code and branch:
            row = db.execute(
                text(f"""
                    SELECT *
                    FROM {schema}.company_info
                    WHERE company_code = :company_code
                      AND branch_code = :branch
                      AND LOWER(status) IN ('active', 'ativa')
                    LIMIT 1
                """),
                {
                    "company_code": str(company_code),
                    "branch": str(branch),
                },
            ).mappings().first()
            return dict(row) if row else None
    except Exception:
        # Tabela company_info não existe no schema do tenant (modelo v2)
        pass

    # 2. Fallback para {schema}.companies (V2)
    try:
        if company_id not in (None, ""):
            row = db.execute(
                text(f"""
                    SELECT id, company_code, branch_code, legal_name, status
                    FROM {schema}.companies
                    WHERE (id::text = :company_id OR company_code = :company_id)
                      AND UPPER(status) = 'ACTIVE'
                    LIMIT 1
                """),
                {"company_id": str(company_id)},
            ).mappings().first()
            if row:
                return dict(row)

        if company_code:
            sql = f"""
                SELECT id, company_code, branch_code, legal_name, status
                FROM {schema}.companies
                WHERE company_code = :company_code
                  AND UPPER(status) = 'ACTIVE'
            """
            params: dict[str, Any] = {"company_code": str(company_code)}
            if branch:
                sql += " AND branch_code = :branch"
                params["branch"] = str(branch)
            sql += " LIMIT 1"
            row = db.execute(text(sql), params).mappings().first()
            if row:
                return dict(row)

        # Fallback de empresa ativa se não houver filtro restritivo
        if company_id in (None, "") and not company_code:
            fallback = db.execute(
                text(f"""
                    SELECT id, company_code, branch_code, legal_name, status
                    FROM {schema}.companies
                    WHERE UPPER(status) = 'ACTIVE'
                    ORDER BY created_at ASC
                    LIMIT 1
                """)
            ).mappings().first()
            if fallback:
                return dict(fallback)
    except Exception:
        pass

    return None


def resolve_context(
    db: Any,
    payload: Mapping[str, Any],
) -> ProtheusContext:
    raw_context = payload.get("context") or {}

    tenant_value = raw_context.get("tenant_id") or payload.get("tenant_id")
    tenant_id = clean_tenant_id(tenant_value)

    schema_name = resolve_tenant_schema(db, tenant_id)

    module = raw_context.get("module") or payload.get("module")

    # Inspeciona a pergunta (prompt ou histórico) para direcionamento semântico de módulo
    prompt = (
        payload.get("prompt")
        or payload.get("query")
        or raw_context.get("prompt")
        or raw_context.get("query")
    )
    if not prompt:
        history = payload.get("history") or raw_context.get("history")
        if isinstance(history, list):
            for turn in reversed(history):
                if isinstance(turn, dict) and turn.get("role") == "user":
                    past_text = turn.get("content") or turn.get("text")
                    if past_text:
                        prompt = past_text
                        break

    if prompt:
        try:
            from app.services.business import infer_query_domain
            domain = infer_query_domain(str(prompt))
            domain_to_module = {
                "finance": "SIGAFIN",
                "sales": "SIGAFAT",
                "purchases": "SIGACOM",
                "stock": "SIGAEST",
                "inventory": "SIGAEST",
                "fiscal": "SIGAFIS",
                "accounting": "SIGACTB",
            }
            mapped_module = domain_to_module.get(domain) if domain else None
            if mapped_module:
                module = mapped_module
        except Exception:
            pass

    # Normaliza domínios semânticos passados diretamente no campo module
    mod_str = str(module or "").strip().lower()
    if mod_str in ("sales", "vendas", "faturamento"):
        module = "SIGAFAT"
    elif mod_str in ("finance", "financeiro"):
        module = "SIGAFIN"
    elif mod_str in ("purchases", "compras"):
        module = "SIGACOM"
    elif mod_str in ("stock", "inventory", "estoque"):
        module = "SIGAEST"
    elif mod_str in ("fiscal",):
        module = "SIGAFIS"
    elif mod_str in ("accounting", "controladoria", "contabilidade"):
        module = "SIGACTB"

    if not module or not str(module).strip():
        raise ValueError("module é obrigatório para execução no Protheus.")

    branch = (
        raw_context.get("branch")
        or raw_context.get("filial")
        or payload.get("branch")
        or payload.get("filial")
    )
    if not branch or not str(branch).strip():
        raise ValueError("branch/filial é obrigatório para execução no Protheus.")

    company_id = raw_context.get("company_id") or payload.get("company_id")
    company_code = (
        raw_context.get("company_code")
        or raw_context.get("company")
        or payload.get("company_code")
        or payload.get("company")
        or payload.get("empresa")
    )
    if company_id in (None, "") and not company_code:
        raise ValueError("company_id ou company_code é obrigatório para execução no Protheus.")

    company = resolve_company(
        db=db,
        schema_name=schema_name,
        company_id=company_id,
        company_code=company_code,
        branch=branch,
    )

    if not company:
        raise ValueError(
            "Empresa/filial ativa não localizada para o contexto informado."
        )

    resolved_module = require_tenant_module(
        db,
        schema_name,
        module,
    )

    return ProtheusContext(
        tenant_id=tenant_id,
        schema_name=schema_name,
        company_id=int(company["id"]) if str(company["id"]).isdigit() else str(company["id"]),
        company_code=str(company.get("company_code") or "") or None,
        branch=str(company.get("branch_code") or branch).strip(),
        module_code=resolved_module["mod_code"],
        module_sigla=resolved_module["mod_sigla"],
        module_name=resolved_module.get("mod_name"),
        user=raw_context.get("user") or raw_context.get("usuario"),
        profile=raw_context.get("profile") or raw_context.get("perfil"),
    )

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
    company_id: int
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
            FROM public.tenant
            WHERE tenant_code = :tenant_id
              AND status = 'active'
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

    if company_id not in (None, ""):
        row = db.execute(
            text(f"""
                SELECT *
                FROM {schema}.company_info
                WHERE id = :company_id
                  AND status = 'active'
                LIMIT 1
            """),
            {"company_id": int(company_id)},
        ).mappings().first()

        return dict(row) if row else None

    if company_code and branch:
        row = db.execute(
            text(f"""
                SELECT *
                FROM {schema}.company_info
                WHERE company_code = :company_code
                  AND branch_code = :branch
                  AND status = 'active'
                LIMIT 1
            """),
            {
                "company_code": str(company_code),
                "branch": str(branch),
            },
        ).mappings().first()

        return dict(row) if row else None

    row = db.execute(
        text(f"""
            SELECT *
            FROM {schema}.company_info
            WHERE status = 'active'
            ORDER BY
                default_flag DESC NULLS LAST,
                updated_at DESC NULLS LAST
            LIMIT 1
        """),
    ).mappings().first()

    return dict(row) if row else None


def resolve_context(
    db: Any,
    payload: Mapping[str, Any],
) -> ProtheusContext:
    raw_context = payload.get("context") or {}

    tenant_id = clean_tenant_id(
        raw_context.get("tenant_id") or payload.get("tenant_id")
    )

    schema_name = resolve_tenant_schema(db, tenant_id)

    module = raw_context.get("module") or payload.get("module")
    branch = raw_context.get("branch") or raw_context.get("filial")

    if not module or not branch:
        raise ValueError(
            "Contexto Protheus incompleto: module e branch são obrigatórios."
        )

    company = resolve_company(
        db=db,
        schema_name=schema_name,
        company_id=raw_context.get("company_id") or payload.get("company_id"),
        company_code=raw_context.get("company_code") or raw_context.get("company"),
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
        company_id=int(company["id"]),
        company_code=str(company.get("company_code") or "") or None,
        branch=str(company.get("branch_code") or branch),
        module_code=resolved_module["mod_code"],
        module_sigla=resolved_module["mod_sigla"],
        module_name=resolved_module.get("mod_name"),
        user=raw_context.get("user") or raw_context.get("usuario"),
        profile=raw_context.get("profile") or raw_context.get("perfil"),
    )

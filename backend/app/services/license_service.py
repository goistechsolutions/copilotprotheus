import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

import jwt
from sqlalchemy import text

from app.core.config import settings
from app.services.protheus_module_catalog import quote_tenant_schema


LICENSE_SECRET = settings.jwt_secret + "-license-key-salt"


def _normalize_cnpj(value: Optional[str]) -> str:
    """Compara CNPJ pelo valor numérico, preservando apenas os 14 dígitos."""
    return re.sub(r"\D", "", str(value or ""))


def generate_license(cnpj: str, expiration_date: str, plan_level: str = "standard") -> str:
    """
    Gera um token JWT assinado contendo as informações da licença.
    expiration_date deve estar no formato YYYY-MM-DD.
    """
    date_str = expiration_date[:10] if "T" in expiration_date else expiration_date
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    payload = {
        "cnpj": _normalize_cnpj(cnpj),
        "exp": int(dt.timestamp()),
        "plan_level": str(plan_level or "").strip(),
        "generated_at": datetime.now().isoformat(),
    }
    return jwt.encode(payload, LICENSE_SECRET, algorithm="HS256")


def verify_license(license_token: str, expected_cnpj: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifica e decodifica a licença. Retorna as informações se válida.
    Lança exceções em caso de token inválido/expirado.
    """
    payload = jwt.decode(license_token, LICENSE_SECRET, algorithms=["HS256"])
    if expected_cnpj and _normalize_cnpj(payload.get("cnpj")) != _normalize_cnpj(expected_cnpj):
        raise ValueError("O CNPJ da licença não corresponde ao CNPJ da empresa.")
    return payload


def is_license_active(license_token: Optional[str], cnpj: str) -> bool:
    """Verifica de forma booleana se a licença está ativa e corresponde ao CNPJ."""
    if not license_token:
        return False
    try:
        verify_license(license_token, expected_cnpj=cnpj)
        return True
    except Exception:
        return False


def sync_license_entitlement(
    db: Any,
    *,
    tenant_code: str,
    tenant_schema: str,
    plan_code: Optional[str],
    license_token: Optional[str],
    cnpj: Optional[str],
) -> Optional[Dict[str, Any]]:
    """Materializa uma licença JWT válida no modelo contratual do entitlement.

    A função não cria planos, limites, módulos ou datas arbitrárias. O plano deve
    existir e estar ativo em ``public.license_plans``; a validade vem do token
    assinado; e os módulos vêm exclusivamente de ``<tenant>.protheus_modules``.
    Sem token, nada é alterado para preservar contratos administrados diretamente.
    """
    token = str(license_token or "").strip()
    if not token:
        return None

    tenant = str(tenant_code or "").strip().lower()
    if not tenant or tenant in {"public", "default", "none", "null"}:
        raise ValueError("Tenant real é obrigatório para ativar a licença contratual.")

    claims = verify_license(token, expected_cnpj=cnpj)
    resolved_plan = str(plan_code or claims.get("plan_level") or "").strip().lower()
    if not resolved_plan:
        raise ValueError("Plano da licença não foi informado.")

    plan = db.execute(
        text("""
            SELECT id::text AS plan_id, plan_code
            FROM public.license_plans
            WHERE lower(btrim(plan_code)) = :plan_code
              AND active = TRUE
            LIMIT 1
        """),
        {"plan_code": resolved_plan},
    ).mappings().first()
    if not plan:
        raise ValueError(
            f"Plano de licença '{resolved_plan}' não existe ou está inativo em license_plans."
        )

    expires_at = datetime.fromtimestamp(int(claims["exp"]), tz=timezone.utc).date()
    if expires_at < date.today():
        raise ValueError("A licença está expirada.")

    contract_code = f"license:{tenant}"[:80]
    existing = db.execute(
        text("""
            SELECT id::text AS contract_id
            FROM public.tenant_contracts
            WHERE lower(btrim(tenant_id)) = :tenant_code
              AND contract_code = :contract_code
            LIMIT 1
        """),
        {"tenant_code": tenant, "contract_code": contract_code},
    ).mappings().first()

    if existing:
        contract_id = str(existing["contract_id"])
        db.execute(
            text("""
                UPDATE public.tenant_contracts
                SET plan_id = CAST(:plan_id AS uuid),
                    contract_status = 'active',
                    starts_at = LEAST(starts_at, CURRENT_DATE),
                    ends_at = :ends_at,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id::text = :contract_id
                  AND lower(btrim(tenant_id)) = :tenant_code
            """),
            {
                "plan_id": str(plan["plan_id"]),
                "ends_at": expires_at,
                "contract_id": contract_id,
                "tenant_code": tenant,
            },
        )
    else:
        contract_id = str(
            db.execute(
                text("""
                    INSERT INTO public.tenant_contracts
                        (tenant_id, plan_id, contract_code, contract_status, starts_at, ends_at, notes)
                    VALUES
                        (:tenant_code, CAST(:plan_id AS uuid), :contract_code, 'active', CURRENT_DATE, :ends_at,
                         'Migrado de licença JWT assinada do cadastro de tenant')
                    RETURNING id::text
                """),
                {
                    "tenant_code": tenant,
                    "plan_id": str(plan["plan_id"]),
                    "contract_code": contract_code,
                    "ends_at": expires_at,
                },
            ).scalar()
        )

    schema = quote_tenant_schema(str(tenant_schema or tenant).strip().lower())
    db.execute(
        text("""
            DELETE FROM public.tenant_module_contracts
            WHERE contract_id::text = :contract_id
              AND lower(btrim(tenant_id)) = :tenant_code
        """),
        {"contract_id": contract_id, "tenant_code": tenant},
    )
    db.execute(
        text(f"""
            INSERT INTO public.tenant_module_contracts
                (tenant_id, contract_id, module_id, status)
            SELECT
                :tenant_code,
                CAST(:contract_id AS uuid),
                pm.id,
                'allowed'
            FROM {schema}.protheus_modules tm
            JOIN public.protheus_modules_master pm
              ON pm.mod_code = tm.mod_code
            WHERE pm.active = TRUE
        """),
        {"contract_id": contract_id, "tenant_code": tenant},
    )
    db.commit()

    return {
        "contract_id": contract_id,
        "plan_code": str(plan["plan_code"]),
        "ends_at": expires_at.isoformat(),
    }

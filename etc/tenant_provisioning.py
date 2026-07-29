"""
tenant_provisioning.py
Serviço responsável por criar, migrar e desativar schemas de tenant.
Substitui a lógica anterior baseada em tenant_id em tabelas compartilhadas.
"""
import re
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TEMPLATE_PATH = Path(__file__).parent / "02_tenant_schema_template.sql"
if not TEMPLATE_PATH.exists():
    TEMPLATE_PATH = Path(__file__).parent / "sql" / "02_tenant_schema_template.sql"

SLUG_RE = re.compile(r"^[a-z0-9_]+$")


class TenantProvisioningError(Exception):
    pass


def build_schema_name(tenant_code: str) -> str:
    if not SLUG_RE.match(tenant_code):
        raise TenantProvisioningError(
            f"tenant_code inválido: '{tenant_code}'. Use apenas [a-z0-9_]."
        )
    return f"tenant_{tenant_code}"


async def provision_tenant_schema(db: AsyncSession, tenant_code: str, tenant_name: str, plan_code: str | None = None) -> str:
    """
    Cria o schema do tenant e aplica o template estrutural.
    Idempotente: se o schema já existir, apenas garante que as tabelas existem.
    """
    schema_name = build_schema_name(tenant_code)

    async with db.begin():
        # 1. Registrar (ou recuperar) no núcleo global
        result = await db.execute(
            text("""
                INSERT INTO public.tenant_registry (tenant_code, tenant_name, schema_name, status, plan_code)
                VALUES (:tenant_code, :tenant_name, :schema_name, 'provisioning', :plan_code)
                ON CONFLICT (tenant_code) DO UPDATE SET updated_at = NOW()
                RETURNING id
            """),
            {"tenant_code": tenant_code, "tenant_name": tenant_name,
             "schema_name": schema_name, "plan_code": plan_code},
        )
        registry_id = result.scalar_one()

        # 2. Criar schema + tabelas a partir do template
        raw_sql = TEMPLATE_PATH.read_text(encoding="utf-8")
        rendered_sql = raw_sql.replace("{{schema}}", schema_name)
        for statement in filter(None, (s.strip() for s in rendered_sql.split(";"))):
            await db.execute(text(statement))

        # 3. Marcar como ativo em tenant_registry e sincronizar em public.tenants
        await db.execute(
            text("""
                UPDATE public.tenant_registry
                SET status = 'active', provisioned_at = NOW()
                WHERE id = :id
            """),
            {"id": registry_id},
        )
        await db.execute(
            text("""
                INSERT INTO public.tenants (id, name, tenant_code, tenant_name, status, plan_code)
                VALUES (:tenant_code, :tenant_name, :tenant_code, :tenant_name, 'active', :plan_code)
                ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), status = 'active'
            """),
            {"tenant_code": tenant_code, "tenant_name": tenant_name, "plan_code": plan_code},
        )

    return schema_name


async def decommission_tenant_schema(db: AsyncSession, tenant_code: str, drop_schema: bool = False) -> None:
    """
    Desativa um tenant. Por padrão NÃO apaga o schema (soft decommission),
    apenas marca como decommissioned para permitir backup/auditoria posterior.
    """
    schema_name = build_schema_name(tenant_code)
    async with db.begin():
        await db.execute(
            text("""
                UPDATE public.tenant_registry
                SET status = 'decommissioned', decommissioned_at = NOW()
                WHERE tenant_code = :tenant_code
            """),
            {"tenant_code": tenant_code},
        )
        if drop_schema:
            await db.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))


async def resolve_schema_for_tenant(db: AsyncSession, tenant_code: str) -> str:
    result = await db.execute(
        text("""
            SELECT schema_name FROM public.tenant_registry
            WHERE tenant_code = :tenant_code AND status = 'active'
        """),
        {"tenant_code": tenant_code},
    )
    row = result.first()
    if not row:
        raise TenantProvisioningError(f"Tenant '{tenant_code}' inativo ou inexistente.")
    return row[0]

"""
seed_dev_tenants.py
Script de apoio para recriar rapidamente tenants de teste após o reset,
usando o novo tenant_provisioning.py.
"""
import asyncio
from db_session import SessionLocal
from tenant_provisioning import provision_tenant_schema

DEV_TENANTS = [
    {"tenant_code": "elitecorp", "tenant_name": "Elite Corp Tecnologia", "plan_code": "trial"},
    {"tenant_code": "rodol_matriz", "tenant_name": "Rodoviário Liderança Matriz", "plan_code": "enterprise"},
    {"tenant_code": "cliente_teste", "tenant_name": "Cliente Teste Homologação", "plan_code": "trial"},
]

async def main():
    async with SessionLocal() as db:
        for t in DEV_TENANTS:
            schema = await provision_tenant_schema(db, **t)
            print(f"Tenant '{t['tenant_code']}' provisionado -> schema '{schema}'")

if __name__ == "__main__":
    asyncio.run(main())

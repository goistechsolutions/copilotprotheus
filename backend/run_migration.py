import sys
import os
from dotenv import load_dotenv

# Adiciona o diretório backend ao PYTHONPATH
sys.path.append(os.path.abspath("."))
load_dotenv(".env")

from sqlalchemy import text
from app.db.database import SessionLocal, ensure_tenant_tables

db = SessionLocal()

try:
    # 1. Garante que o tenant 'rodol' existe na public.tenants
    print("Registrando tenant na public.tenants...")
    db.execute(text("""
        INSERT INTO public.tenants (tenant_code, tenant_name, schema_name, status)
        VALUES ('rodol', 'Rodol', 'rodol', 'ACTIVE')
        ON CONFLICT (tenant_code) DO NOTHING
    """))
    db.commit()

    # 2. Cria as tabelas da V2 (companies, environments, etc) no schema 'rodol'
    print("Criando tabelas da V2 para o schema rodol...")
    ensure_tenant_tables(db, "rodol")
    db.commit()

    # 3. Migra os dados da tabela velha (company_info) para as tabelas novas
    print("Migrando dados de company_info para companies...")
    db.execute(text("""
        INSERT INTO rodol.companies (company_code, branch_code, legal_name, tax_id, status)
        SELECT company_code, branch_code, razao_social, cnpj, 'ACTIVE'
        FROM rodol.company_info
        ON CONFLICT (company_code, branch_code) DO NOTHING
    """))
    db.commit()

    print("Migrando dados de company_info para environments...")
    db.execute(text("""
        INSERT INTO rodol.environments (environment_code, environment_name, status)
        SELECT protheus_ambientes, protheus_ambientes, 'ACTIVE'
        FROM rodol.company_info
        ON CONFLICT (environment_code) DO NOTHING
    """))
    db.commit()

    print("Migrando dados de company_info para protheus_connections...")
    db.execute(text("""
        INSERT INTO rodol.protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
        SELECT e.id, c.protheus_rest_url, 'oauth2_password', 
            json_build_object('protheus_username', c.protheus_usuario, 'encrypted_protheus_password', c.encrypted_protheus_password),
            true
        FROM rodol.company_info c
        JOIN rodol.environments e ON e.environment_code = c.protheus_ambientes
        ON CONFLICT (environment_id) DO NOTHING
    """))
    db.commit()

    print("Migracao finalizada com sucesso! Tabelas V2 criadas e populadas.")

except Exception as e:
    db.rollback()
    print(f"Erro: {e}")
finally:
    db.close()

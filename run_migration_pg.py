import psycopg2
from psycopg2.extras import RealDictCursor

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"

try:
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    # 1. Tenant public.tenants
    print("Registrando tenant na public.tenants...")
    cur.execute("INSERT INTO public.tenants (tenant_code, tenant_name, schema_name, status) VALUES ('rodol', 'Rodol', 'rodol', 'ACTIVE') ON CONFLICT DO NOTHING")
    
    # 2. CREATE V2 TABLES manually to avoid sqlalchemy and Alembic
    print("Criando tabelas da V2 manualmente...")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rodol.companies (
        id SERIAL PRIMARY KEY,
        company_code VARCHAR(50) NOT NULL,
        branch_code VARCHAR(50) NOT NULL,
        legal_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        tax_id VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT companies_company_code_branch_code_key UNIQUE (company_code, branch_code)
    );

    CREATE TABLE IF NOT EXISTS rodol.environments (
        id SERIAL PRIMARY KEY,
        environment_code VARCHAR(100) NOT NULL UNIQUE,
        environment_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rodol.protheus_connections (
        id SERIAL PRIMARY KEY,
        environment_id INTEGER NOT NULL REFERENCES rodol.environments(id) ON DELETE CASCADE,
        base_rest_url VARCHAR(255) NOT NULL,
        auth_mode VARCHAR(50) NOT NULL,
        secret_ref TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT protheus_connections_environment_id_key UNIQUE (environment_id)
    );
    """)

    # 3. Migrate data
    print("Migrando dados de company_info para companies...")
    cur.execute("""
        INSERT INTO rodol.companies (company_code, branch_code, legal_name, tax_id, status)
        SELECT company_code, branch_code, razao_social, cnpj, 'ACTIVE'
        FROM rodol.company_info
        ON CONFLICT (company_code, branch_code) DO NOTHING
    """)

    print("Migrando dados de company_info para environments...")
    cur.execute("""
        INSERT INTO rodol.environments (environment_code, environment_name, status)
        SELECT protheus_ambientes, protheus_ambientes, 'ACTIVE'
        FROM rodol.company_info
        ON CONFLICT (environment_code) DO NOTHING
    """)

    print("Migrando dados de company_info para protheus_connections...")
    cur.execute("""
        INSERT INTO rodol.protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
        SELECT e.id, c.protheus_rest_url, 'oauth2_password', 
            json_build_object('protheus_username', c.protheus_usuario, 'encrypted_protheus_password', c.encrypted_protheus_password)::text,
            true
        FROM rodol.company_info c
        JOIN rodol.environments e ON e.environment_code = c.protheus_ambientes
        ON CONFLICT (environment_id) DO NOTHING
    """)

    conn.commit()
    print("Migração finalizada com sucesso! Tabelas V2 criadas e populadas.")

except Exception as e:
    if conn:
        conn.rollback()
    print(f"Erro: {e}")
finally:
    if conn:
        conn.close()

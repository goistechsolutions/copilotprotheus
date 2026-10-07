import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

# 1. Copiar de company_info para companies
cur.execute("""
INSERT INTO rodol.companies (company_code, branch_code, legal_name, tax_id, status)
SELECT company_code, branch_code, razao_social, cnpj, status
FROM rodol.company_info
ON CONFLICT (company_code, branch_code) DO NOTHING
""")

# 2. Copiar para environments
cur.execute("""
INSERT INTO rodol.environments (environment_code, environment_name, status)
SELECT protheus_ambientes, protheus_ambientes, 'ACTIVE'
FROM rodol.company_info
ON CONFLICT (environment_code) DO NOTHING
""")

# 3. Copiar para protheus_connections
cur.execute("""
INSERT INTO rodol.protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
SELECT e.id, c.protheus_rest_url, 'oauth2_password', 
    json_build_object('protheus_username', c.protheus_usuario, 'encrypted_protheus_password', c.encrypted_protheus_password),
    true
FROM rodol.company_info c
JOIN rodol.environments e ON e.environment_code = c.protheus_ambientes
ON CONFLICT (environment_id) DO NOTHING
""")

conn.commit()
conn.close()
print("Migration completed!")

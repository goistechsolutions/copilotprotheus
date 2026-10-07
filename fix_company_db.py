import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
conn.autocommit = True
cur = conn.cursor()

sql = """
CREATE TABLE IF NOT EXISTS "rodol".company_info (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    company_code VARCHAR(60) NOT NULL,
    branch_code VARCHAR(60) NOT NULL DEFAULT '0101',
    company_name VARCHAR(200) NOT NULL,
    cnpj VARCHAR(30),
    ie VARCHAR(30),
    razao_social VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(50),
    endereco VARCHAR(255),
    protheus_grupo VARCHAR(60),
    protheus_empresa VARCHAR(60),
    protheus_unidade VARCHAR(60),
    protheus_filial VARCHAR(60),
    environment VARCHAR(30),
    protheus_ambientes VARCHAR(100),
    webapp_url VARCHAR(500),
    protheus_rest_url VARCHAR(500),
    protheus_usuario VARCHAR(100),
    encrypted_protheus_password VARCHAR(500),
    auth_mode VARCHAR(30) DEFAULT 'basic',
    status VARCHAR(30) DEFAULT 'ativa',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(company_code, branch_code)
);
"""

cur.execute(sql)
print("company_info created for rodol")
conn.close()

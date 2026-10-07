import psycopg2

dsn = "postgresql://postgres:senha_local@localhost:5435/copilot"
conn = psycopg2.connect(dsn)
cur = conn.cursor()

try:
    print("Inserindo na tabela rodol_prd.companies...")
    cur.execute("""
        INSERT INTO rodol_prd.companies (company_code, branch_code, legal_name, tax_id, status)
        VALUES ('01', '0101', 'Rodol', '02.524.305/0001-28', 'ACTIVE')
        ON CONFLICT (company_code, branch_code) DO UPDATE SET
            legal_name = EXCLUDED.legal_name,
            tax_id = EXCLUDED.tax_id,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id
    """)
    company_id = cur.fetchone()[0]

    print("Inserindo na tabela rodol_prd.environments...")
    cur.execute("""
        INSERT INTO rodol_prd.environments (environment_code, environment_name, status)
        VALUES ('c8te0u_prod', 'c8te0u_prod', 'ACTIVE')
        ON CONFLICT (environment_code) DO UPDATE SET
            environment_name = EXCLUDED.environment_name,
            status = 'ACTIVE'
        RETURNING id
    """)
    env_id = cur.fetchone()[0]

    print("Inserindo na tabela rodol_prd.protheus_connections...")
    cur.execute("""
        INSERT INTO rodol_prd.protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
        VALUES (%s, 'https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest', 'oauth2_password', 
                '{"protheus_username": "admin", "encrypted_protheus_password": "gAAAAABqxd_6dRGrD_GnS7A2JI7J5obFPEmXbfz0PKDrr_wlmQB4OoLcEBsL4mHmUz9RYGELsb-Saw6VpsY-yUOvpqlCTzt5Rw=="}', 
                true)
        ON CONFLICT (environment_id) DO UPDATE SET
            base_rest_url = EXCLUDED.base_rest_url,
            secret_ref = EXCLUDED.secret_ref,
            active = true,
            updated_at = NOW()
    """, (env_id,))

    conn.commit()
    print("✅ Dados da Rodol inseridos na V2 com sucesso no schema rodol_prd!")

except Exception as e:
    conn.rollback()
    print(f"Erro: {e}")
finally:
    conn.close()

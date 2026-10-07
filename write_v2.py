import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the GET /companies logic
new_get_logic = """
@router.get("/companies")
def get_companies_list(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    \"\"\"Retorna todas as companies mapeadas para o V1 shape usando tables V2.\"\"\"
    companies = []
    
    # Iterate all active tenants
    tenants = db.execute(text("SELECT id, schema_name FROM public.tenants WHERE status = 'ACTIVE'")).mappings().fetchall()
    
    for t in tenants:
        schema = t["schema_name"]
        try:
            sql = f\"\"\"
                SELECT 
                    c.id as company_id,
                    c.company_code,
                    c.branch_code,
                    c.legal_name as razao_social,
                    c.legal_name as company_name,
                    c.tax_id as cnpj,
                    c.status,
                    e.environment_code as protheus_ambientes,
                    e.id as env_id,
                    p.base_rest_url as protheus_rest_url
                FROM "{schema}".companies c
                LEFT JOIN "{schema}".environments e ON e.status = 'ACTIVE'
                LEFT JOIN "{schema}".protheus_connections p ON p.environment_id = e.id AND p.active = TRUE
            \"\"\"
            rows = db.execute(text(sql)).mappings().fetchall()
            for r in rows:
                c_dict = dict(r)
                c_dict["tenant_id"] = schema
                c_dict["id"] = r["company_id"]
                companies.append(c_dict)
        except Exception as e:
            pass
            
    return companies
"""

content = re.sub(r'@router\.get\("/companies"\).*?def get_companies_list.*?(?=@router\.)', new_get_logic, content, flags=re.DOTALL | re.MULTILINE)

new_create_logic = """
@router.post("/companies")
async def create_company(payload: CompanyCreate, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    import json
    from app.core.security import encrypt_password
    
    raw_tenant = str(payload.tenant_id or payload.protheus_grupo or "").strip()
    if not raw_tenant:
        raise HTTPException(status_code=400, detail="tenant_id é obrigatório para criar uma empresa.")
        
    tenant_code = raw_tenant
    
    try:
        if raw_tenant.isdigit():
            reg = db.execute(text("SELECT tenant_code, schema_name FROM public.tenants WHERE id = :id OR tenant_code = :tc"), {"id": int(raw_tenant), "tc": raw_tenant}).mappings().first()
            if reg:
                tenant_code = reg["schema_name"] or reg["tenant_code"]
        else:
            reg = db.execute(text("SELECT tenant_code, schema_name FROM public.tenants WHERE tenant_code = :tc OR schema_name = :tc"), {"tc": raw_tenant}).mappings().first()
            if reg:
                tenant_code = reg["schema_name"] or reg["tenant_code"]
    except Exception:
        pass
        
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    if not clean_tenant or clean_tenant == "public":
        raise HTTPException(status_code=400, detail="tenant_id inválido para criação da empresa.")
        
    authorize_admin_access(admin, "companies:write", clean_tenant)
    
    db.execute(text(\"\"\"
        INSERT INTO public.tenants (tenant_code, tenant_name, schema_name, status)
        VALUES (:tenant_code, :tenant_name, :schema_name, 'ACTIVE')
        ON CONFLICT (tenant_code) DO UPDATE SET
            tenant_name = EXCLUDED.tenant_name,
            schema_name = EXCLUDED.schema_name,
            status = 'ACTIVE',
            updated_at = NOW()
    \"\"\"), {
        "tenant_code": clean_tenant,
        "tenant_name": (payload.razao_social or payload.company_name).strip(),
        "schema_name": clean_tenant,
    })
    db.commit()
    
    from app.db.database import ensure_tenant_tables
    ensure_tenant_tables(db, clean_tenant)
    
    c_code = (payload.protheus_empresa or payload.company_code).strip()
    b_code = (payload.protheus_filial or payload.branch_code or "0101").strip()
    c_name = (payload.razao_social or payload.company_name).strip()
    c_env  = (payload.protheus_ambientes or payload.environment or "PROD").strip()
    
    if not c_code or not b_code or not c_name:
        raise HTTPException(status_code=400, detail="company_code, branch_code e company_name são obrigatórios.")
        
    # V2 Insert Companies
    company_id = db.execute(text(f\"\"\"
        INSERT INTO "{clean_tenant}".companies (company_code, branch_code, legal_name, tax_id, status)
        VALUES (:c_code, :b_code, :c_name, :cnpj, :status)
        ON CONFLICT (company_code, branch_code) DO UPDATE SET
            legal_name = EXCLUDED.legal_name,
            tax_id = EXCLUDED.tax_id,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id
    \"\"\"), {
        "c_code": c_code, "b_code": b_code, "c_name": c_name, "cnpj": payload.cnpj, "status": 'ACTIVE'
    }).scalar()
    
    # V2 Insert Environment
    env_id = db.execute(text(f\"\"\"
        INSERT INTO "{clean_tenant}".environments (environment_code, environment_name, status)
        VALUES (:env_code, :env_name, 'ACTIVE')
        ON CONFLICT (environment_code) DO UPDATE SET
            environment_name = EXCLUDED.environment_name,
            status = 'ACTIVE'
        RETURNING id
    \"\"\"), {
        "env_code": c_env, "env_name": c_env
    }).scalar()
    
    # V2 Insert Protheus Connection
    if payload.protheus_rest_url:
        sec_data = {
            "protheus_username": payload.protheus_usuario,
            "encrypted_protheus_password": encrypt_password(payload.protheus_password) if payload.protheus_password else None
        }
        db.execute(text(f\"\"\"
            INSERT INTO "{clean_tenant}".protheus_connections (environment_id, base_rest_url, auth_mode, secret_ref, active)
            VALUES (:env_id, :url, 'oauth2_password', :sec, true)
            ON CONFLICT (environment_id) DO UPDATE SET
                base_rest_url = EXCLUDED.base_rest_url,
                secret_ref = EXCLUDED.secret_ref,
                active = true,
                updated_at = NOW()
        \"\"\"), {
            "env_id": env_id,
            "url": payload.protheus_rest_url,
            "sec": json.dumps(sec_data)
        })
        
    db.commit()
    
    return {
        "id": str(company_id),
        "tenant_id": clean_tenant,
        "cnpj": payload.cnpj,
        "razao_social": c_name,
        "protheus_ambientes": c_env,
        "protheus_rest_url": payload.protheus_rest_url,
        "status": "ativa"
    }
"""

content = re.sub(r'@router\.post\("/companies"\).*?async def create_company.*?(?=@router\.)', new_create_logic + "\n\n", content, flags=re.DOTALL | re.MULTILINE)

with open('backend/app/api/company_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

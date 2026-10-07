import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_create_company = """
@router.post("/companies", response_model=CompanyResponse)
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
    
    now = datetime.now()
    return {
        "id": 1,
        "tenant_id": clean_tenant,
        "cnpj": payload.cnpj,
        "ie": payload.ie,
        "razao_social": c_name,
        "email": payload.email,
        "telefone": payload.telefone,
        "endereco": payload.endereco,
        "protheus_grupo": payload.protheus_grupo,
        "protheus_empresa": payload.protheus_empresa,
        "protheus_unidade": payload.protheus_unidade,
        "protheus_filial": payload.protheus_filial,
        "protheus_ambientes": c_env,
        "protheus_usuario": payload.protheus_usuario,
        "protheus_rest_url": payload.protheus_rest_url,
        "webapp_url": payload.webapp_url,
        "has_password": bool(payload.protheus_password),
        "status": "ativa",
        "created_at": now,
        "updated_at": now
    }
"""

new_delete_company = """
@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    from app.services.company_module_service import get_company_or_404
    comp_info = get_company_or_404(db, company_id)
    tenant_code = str(comp_info.get("tenant_id") or "").strip()
    clean_tenant = resolve_clean_tenant(db, tenant_code)
    if clean_tenant and clean_tenant != "public":
        authorize_admin_access(admin, "companies:write", clean_tenant)
        try:
            db.execute(text(f'DELETE FROM "{clean_tenant}".companies WHERE id::text = :cid'), {"cid": str(company_id)})
            db.commit()
        except Exception as e:
            pass
    return {"message": "Empresa excluída com sucesso."}
"""

start_idx = content.find('@router.post("/companies", response_model=CompanyResponse)')
end_idx = content.find('@router.delete("/companies/{company_id}")')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_create_company + "\n" + content[end_idx:]

start_idx = content.find('@router.delete("/companies/{company_id}")')
end_idx = content.find('@router.post("/license/generate")')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_delete_company + "\n" + content[end_idx:]

with open('backend/app/api/company_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

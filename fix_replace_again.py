import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """def replace_company_modules(db, company_id, tenant_id: str, payload) -> int:
    clean_tenant = resolve_clean_tenant(tenant_id)
    if not clean_tenant:
        raise HTTPException(status_code=404, detail="Tenant inválido")

    try:
        db.execute(text(f'UPDATE "{clean_tenant}".tenant_modules SET enabled = false'))
        
        master_catalog = get_company_modules_catalog(db)
        
        for item in payload.modules:
            sigla = str(getattr(item, "module_code", item[0] if isinstance(item, tuple) else item)).strip().upper()
            master = master_catalog.get(sigla)
            if not master:
                raise ValueError(f"Module {sigla} not found")
                
            m_id = master["module_id"]
            db.execute(
                text(f'''
                    INSERT INTO "{clean_tenant}".tenant_modules (module_id, enabled)
                    VALUES (:mid, true)
                    ON CONFLICT (module_id) DO UPDATE SET enabled = true
                '''),
                {"mid": m_id}
            )
            
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar módulos: {e}")

    return 1
"""

content = re.sub(r'def replace_company_modules.*?return get_tenant_module_setup.*?tenant_id\)', replacement, content, flags=re.DOTALL)

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed replace_company_modules signature again")

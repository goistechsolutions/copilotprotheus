import re

def fix_tenant_routes_defasado():
    path = 'backend/app/api/tenant_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix find_tenant_by_id_or_code
    new_find = '''
def find_tenant_by_id_or_code(db: Session, tenant_id: str | int) -> Optional[Tenant]:
    t_str = str(tenant_id or '').strip()
    if not t_str:
        return None
    t = db.query(Tenant).filter(Tenant.tenant_code == t_str).first()
    if not t:
        t = db.query(Tenant).filter(Tenant.schema_name == t_str).first()
    if not t:
        import uuid
        try:
            val_uuid = uuid.UUID(t_str)
            t = db.query(Tenant).filter(Tenant.id == val_uuid).first()
        except ValueError:
            pass
    return t
'''
    content = re.sub(r'def find_tenant_by_id_or_code.*?(?=\n\n\ndef )', new_find.strip(), content, flags=re.DOTALL)

    # Fix _to_tenant_dict
    content = re.sub(r'"plan_code": t\.plan_code,', '"plan_code": getattr(t, "plan_code", None),', content)
    content = re.sub(r'"cnpj": t\.cnpj,', '"cnpj": getattr(t, "cnpj", None),', content)
    content = re.sub(r'"licenca_uso": t\.licenca_uso,', '"licenca_uso": getattr(t, "licenca_uso", None),', content)
    content = re.sub(r'"protheus_webapp_url": t\.webapp_url,', '"protheus_webapp_url": getattr(t, "webapp_url", None),', content)
    content = re.sub(r'"system_prompt": t\.system_prompt,', '"system_prompt": getattr(t, "system_prompt", None),', content)
    content = re.sub(r'"temperature": t\.temperature,', '"temperature": getattr(t, "temperature", None),', content)

    # Fix update_tenant
    new_update = '''
@router.put("/{tenant_id}", response_model=dict)
async def update_tenant(tenant_id: str, body: TenantUpdate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    tenant = find_tenant_by_id_or_code(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if body.name:
        tenant.tenant_name = body.name
    if body.status:
        tenant.status = str(body.status).upper()

    db.commit()
    db.refresh(tenant)

    clean_tenant = resolve_clean_tenant(tenant.tenant_code)
    if clean_tenant and clean_tenant != "public":
        db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})
    db.commit()

    # Materializa a licena assinada no contrato exigido pelo EntitlementGuard.
    if getattr(body, "licenca_uso", None) is not None:
        _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

    # Processa e valida conexo REST Protheus
    conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
    if conn_info:
        await _sync_protheus_connection(db, clean_tenant, conn_info)

    return _to_tenant_dict(db, tenant)
'''
    content = re.sub(r'@router\.put\("/\{tenant_id\}"[\s\S]*?return _to_tenant_dict\(db, tenant\)', new_update.strip(), content)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_tenant_routes_defasado()

import re

def rewrite_create_tenant():
    path = 'backend/app/api/tenant_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_func = '''
@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    import uuid
    raw_code = body.tenant_code or body.name or body.id or "tenant"
    t_code = resolve_clean_tenant(str(raw_code).lower().strip())
    if not t_code:
        t_code = f"tenant_{uuid.uuid4().hex[:6]}"

    clean_tenant = t_code
    tenant = find_tenant_by_id_or_code(db, clean_tenant)

    if not tenant:
        tenant = Tenant(
            tenant_code=clean_tenant,
            tenant_name=body.name or clean_tenant,
            schema_name=clean_tenant,
            status=(body.status or 'ACTIVE').upper()
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.tenant_name = body.name or tenant.tenant_name
        tenant.status = str(body.status or tenant.status).upper()
        db.flush()

    try:
        # Garante o schema isolado
        db.execute(text("SELECT public.provision_tenant_schema(:tid)"), {"tid": tenant.id})

        # Materializa a licenca assinada no contrato exigido pelo EntitlementGuard.
        if body.licenca_uso is not None:
            _sync_tenant_license_contract(db, tenant, clean_tenant, body.licenca_uso)

        # Processa e valida conexao REST Protheus
        conn_info = extract_connection_info(body, db=db, tenant_code=clean_tenant)
        if conn_info:
            await _sync_protheus_connection(db, clean_tenant, conn_info)

        db.commit()
        db.refresh(tenant)
    except Exception as e:
        db.rollback()
        raise e

    return _to_tenant_dict(db, tenant)
'''

    content = re.sub(
        r'@router\.post\("", response_model=dict, status_code=status\.HTTP_201_CREATED\)[\s\S]*?return _to_tenant_dict\(db, tenant\)',
        new_func.strip(),
        content
    )
    
    # Also remove db.commit from _sync_protheus_connection to prevent breaking the transaction!
    content = content.replace('    db.commit()\n\n    try:\n        invalidate_access_token', '    db.flush()\n\n    try:\n        invalidate_access_token')

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

rewrite_create_tenant()

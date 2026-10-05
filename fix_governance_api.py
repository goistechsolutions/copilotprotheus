import re

with open('backend/app/api/business_governance_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update FieldAliasCreateUpdate
content = re.sub(
    r'    field_description: Optional\[str\] = None\n',
    '    field_description: Optional[str] = None\n    synonyms: Optional[str] = None\n',
    content
)

# Update POST /semantic-dictionary
content = re.sub(
    r'            field_description=payload\.field_description\n',
    '            field_description=payload.field_description,\n            synonyms=payload.synonyms\n',
    content
)

# Oh wait, we also need a PUT endpoint to update aliases!
put_endpoint = """
@router.put("/semantic-dictionary/{alias_id}")
def update_field_alias(alias_id: int, payload: FieldAliasCreateUpdate, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    authorize_admin_access(admin, "governance:write", payload.tenant_id)
    
    # Needs tenant resolver
    from app.services.tenant_resolver import set_tenant_context
    from app.models.business_knowledge import BusinessFieldAlias
    
    set_tenant_context(db, payload.tenant_id)
    alias = db.query(BusinessFieldAlias).filter(BusinessFieldAlias.id == alias_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias nao encontrado no tenant informado")
        
    alias.field_name = payload.field_name
    alias.business_name = payload.business_name
    alias.field_format = payload.field_format
    alias.field_description = payload.field_description
    alias.synonyms = payload.synonyms
    
    db.commit()
    db.refresh(alias)
    return alias
"""

if "@router.put(\"/semantic-dictionary/{alias_id}\")" not in content:
    content += put_endpoint

with open('backend/app/api/business_governance_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

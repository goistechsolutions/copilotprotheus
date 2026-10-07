import re

with open('backend/app/api/admin_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify RoleCreateUpdate
target_schema = """class RoleCreateUpdate(BaseModel):
    role_code:   str
    role_name:   str
    scope_level: str = "tenant"   # platform | tenant | company"""

replacement_schema = """class RoleCreateUpdate(BaseModel):
    role_code:   str | None = None
    role_name:   str | None = None
    name:        str | None = None
    tenant_id:   str | None = "default"
    permissions: list[str] = []
    scope_level: str = "tenant"   # platform | tenant | company"""

content = content.replace(target_schema, replacement_schema)

# Modify list_roles
target_list = """@router.get("/roles")
def list_roles(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    roles = db.query(Role).order_by(Role.role_code).all()
    return [
        {"id": str(r.id), "role_code": r.role_code, "role_name": r.role_name, "scope_level": r.scope_level}
        for r in roles
    ]"""

replacement_list = """@router.get("/roles")
def list_roles(db: Session = Depends(get_db), admin: str = Depends(verify_admin)):
    roles = db.query(Role).order_by(Role.role_code).all()
    return [
        {
            "id": str(r.id), 
            "role_code": r.role_code, 
            "role_name": r.role_name, 
            "name": r.role_name, 
            "scope_level": r.scope_level,
            "tenant_id": "default",
            "permissions": []
        }
        for r in roles
    ]"""

content = content.replace(target_list, replacement_list)

# Modify create_role
target_create = """@router.post("/roles", status_code=status.HTTP_201_CREATED)
def create_role(
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    if db.query(Role).filter(Role.role_code == req.role_code).first():
        raise HTTPException(status_code=409, detail=f"role_code '{req.role_code}' ja existe.")
    db.add(Role(role_code=req.role_code, role_name=req.role_name, scope_level=req.scope_level))
    db.commit()
    return {"success": True}"""

replacement_create = """@router.post("/roles", status_code=status.HTTP_201_CREATED)
def create_role(
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    rc = req.role_code or (req.name.upper() if req.name else "UNKNOWN")
    rn = req.role_name or req.name or "Unknown"
    if db.query(Role).filter(Role.role_code == rc).first():
        raise HTTPException(status_code=409, detail=f"role_code '{rc}' ja existe.")
    db.add(Role(role_code=rc, role_name=rn, scope_level=req.scope_level))
    db.commit()
    return {"success": True}"""

content = content.replace(target_create, replacement_create)

# Modify update_role
target_update = """@router.put("/roles/{role_id}")
def update_role(
    role_id: str,
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role não encontrada.")
    if req.role_code and req.role_code != role.role_code:
        if db.query(Role).filter(Role.role_code == req.role_code).first():
            raise HTTPException(status_code=409, detail=f"role_code '{req.role_code}' ja existe.")
        role.role_code = req.role_code
    if req.role_name:
        role.role_name = req.role_name
    if req.scope_level:
        role.scope_level = req.scope_level
    db.commit()
    return {"success": True}"""

replacement_update = """@router.put("/roles/{role_id}")
def update_role(
    role_id: str,
    req: RoleCreateUpdate,
    db: Session = Depends(get_db),
    admin: str  = Depends(verify_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role não encontrada.")
    
    rc = req.role_code or (req.name.upper() if req.name else None)
    rn = req.role_name or req.name
    
    if rc and rc != role.role_code:
        if db.query(Role).filter(Role.role_code == rc).first():
            raise HTTPException(status_code=409, detail=f"role_code '{rc}' ja existe.")
        role.role_code = rc
    if rn:
        role.role_name = rn
    if req.scope_level:
        role.scope_level = req.scope_level
    db.commit()
    return {"success": True}"""

content = content.replace(target_update, replacement_update)

with open('backend/app/api/admin_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Updated admin_routes.py!")

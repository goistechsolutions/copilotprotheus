from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import User, Role, Tenant
from pydantic import BaseModel
from typing import List, Optional
import hashlib
import uuid
import jwt
from datetime import datetime, timedelta
import os

router = APIRouter(tags=["Auth"])

class RegisterRequest(BaseModel):
    tenant_id: str
    username: str  # will be stored as email
    password: Optional[str] = None
    role: Optional[str] = 'tenant_admin'
    full_name: Optional[str] = 'Usuário do Sistema'

class UserResponse(BaseModel):
    id: str
    tenant_id: Optional[str]
    email: str
    full_name: str
    status: str

    class Config:
        from_attributes = True

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@router.get("/users/{tenant_id}", response_model=List[UserResponse])
def get_users_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        users = db.query(User).filter(User.tenant_id == tenant_uuid).order_by(User.created_at.desc()).all()
        return users
    except ValueError:
        return []

@router.post("/register", response_model=UserResponse)
def register_or_update_agent(req: RegisterRequest, db: Session = Depends(get_db)):
    try:
        tenant_uuid = uuid.UUID(req.tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="tenant_id deve ser um UUID válido na V3")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    existing = db.query(User).filter(User.email == req.username).first()

    if existing:
        if req.password:
            existing.password_hash = hash_password(req.password)
        if req.full_name:
            existing.full_name = req.full_name
        db.commit()
        db.refresh(existing)
        return existing
    else:
        if not req.password:
            raise HTTPException(status_code=400, detail="Senha é obrigatória para novos usuários.")

        new_user = User(
            tenant_id=tenant_uuid,
            email=req.username,
            full_name=req.full_name,
            password_hash=hash_password(req.password)
        )
        db.add(new_user)
        db.flush()

        role = db.query(Role).filter(Role.role_code == req.role).first()
        if role:
            new_user.role_id = role.id

        db.commit()
        db.refresh(new_user)
        return new_user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    try:
        user_uuid = uuid.UUID(user_id)
        user = db.query(User).filter(User.id == user_uuid).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        db.delete(user)
        db.commit()
        return {"message": "Usuário excluído com sucesso"}
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID inválido")

JWT_SECRET = os.getenv("JWT_SECRET", "super_seguro")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 horas

class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_id: str

@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    try:
        tenant_uuid = uuid.UUID(req.tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="tenant_id inválido (deve ser UUID na nova versão v3)")

    user = db.query(User).filter(
        User.tenant_id == tenant_uuid,
        User.email == req.username
    ).first()

    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires

    # Buscar roles
    user_roles_list = (
        db.query(Role.role_code)
        .filter(Role.id == user.role_id)
        .all()
    )
    roles = [r[0] for r in user_roles_list]
    primary_role = roles[0] if roles else 'business_user'

    to_encode = {
        "sub": user.email,
        "tenant_id": str(user.tenant_id),
        "user_id": str(user.id),
        "role": primary_role,
        "exp": expire,
    }

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

    # Seta cookie HttpOnly para suporte a iframes (ex: proxy Adminer no painel admin)
    # SameSite=Lax permite envio em navegação de primeira parte e iframes same-origin
    response.set_cookie(
        key="access_token",
        value=encoded_jwt,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {"access_token": encoded_jwt, "token_type": "bearer", "role": primary_role}


@router.post("/logout")
def logout(response: Response):
    """Expira o cookie 'access_token' no browser.
    Deve ser chamado pelo frontend ao clicar em Logout.
    Apos este endpoint, o iframe do Adminer nao consegue mais autenticar via cookie.
    """
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=0,      # Expira imediatamente
        expires=0,      # Compatibilidade com browsers mais antigos
        path="/",
    )
    return {"success": True, "message": "Logout realizado com sucesso."}

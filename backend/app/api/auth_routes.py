from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import AgentUser
from pydantic import BaseModel
from typing import List, Optional
import hashlib

router = APIRouter(tags=["Auth"])

class RegisterRequest(BaseModel):
    tenant_id: str
    username: str
    password: Optional[str] = None
    role: Optional[str] = 'user'

class UserResponse(BaseModel):
    id: int
    tenant_id: str
    username: str
    role: str

    class Config:
        from_attributes = True

def hash_password(password: str) -> str:
    # Simples hash SHA-256
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@router.get("/users/{tenant_id}", response_model=List[UserResponse])
def get_users_by_tenant(tenant_id: str, db: Session = Depends(get_db)):
    users = db.query(AgentUser).filter(AgentUser.tenant_id == tenant_id).order_by(AgentUser.id.desc()).all()
    return users

@router.post("/register", response_model=UserResponse)
def register_or_update_agent(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check se o usuário já existe no tenant
    existing = db.query(AgentUser).filter(
        AgentUser.tenant_id == req.tenant_id,
        AgentUser.username == req.username
    ).first()
    
    if existing:
        if req.password:
            existing.password_hash = hash_password(req.password)
        if req.role:
            existing.role = req.role
        db.commit()
        db.refresh(existing)
        return existing
    else:
        if not req.password:
            raise HTTPException(status_code=400, detail="Senha é obrigatória para novos usuários.")
        
        new_user = AgentUser(
            tenant_id=req.tenant_id,
            username=req.username,
            password_hash=hash_password(req.password),
            role=req.role or 'user'
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(AgentUser).filter(AgentUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    db.delete(user)
    db.commit()
    return {"message": "Usuário excluído com sucesso"}

import jwt
from datetime import datetime, timedelta
import os

JWT_SECRET = os.getenv("JWT_SECRET", "super_seguro")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 horas

class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_id: str

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AgentUser).filter(
        AgentUser.tenant_id == req.tenant_id,
        AgentUser.username == req.username
    ).first()
    
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    
    to_encode = {
        "sub": user.username,
        "tenant_id": user.tenant_id,
        "role": user.role,
        "exp": expire
    }
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    
    return {"access_token": encoded_jwt, "token_type": "bearer", "role": user.role}

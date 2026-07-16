from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.knowledge import AgentUser
from pydantic import BaseModel
import hashlib

router = APIRouter(tags=["Auth"])

class RegisterRequest(BaseModel):
    tenant_id: str
    username: str
    password: str

def hash_password(password: str) -> str:
    # Simples hash SHA-256
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@router.post("/register")
def register_agent(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check se o usuário já existe
    existing = db.query(AgentUser).filter(
        AgentUser.tenant_id == req.tenant_id,
        AgentUser.username == req.username
    ).first()
    
    hashed = hash_password(req.password)
    
    if existing:
        existing.password_hash = hashed
        db.commit()
        return {"message": "Senha atualizada com sucesso"}
    else:
        new_user = AgentUser(
            tenant_id=req.tenant_id,
            username=req.username,
            password_hash=hashed
        )
        db.add(new_user)
        db.commit()
        return {"message": "Usuário registrado com sucesso"}

"""Endpoints de usuários."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.db.session import get_db
from app.routers.auth import get_current_user
from app.schemas.users import UserCreate, UserOut

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("/me", response_model=UserOut, summary="Dados do usuário logado")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED,
             summary="Criar usuário")
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email já cadastrado",
        )
    user = User(
        id=str(uuid.uuid4()),
        tenant_id=payload.tenant_id,
        email=payload.email,
        hashed_password=pwd_context.hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

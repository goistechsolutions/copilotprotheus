"""Admin JWT Authentication Routes"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel
import jwt
import os

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "elitecorp-admin-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8
COOKIE_NAME = "admin_token"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


def create_admin_token() -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": "admin", "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub") == "admin"
    except Exception:
        return False


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    if request.username != ADMIN_USER or request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_admin_token()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # True em produção com HTTPS
        samesite="lax",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )
    return LoginResponse(success=True, message="Login realizado com sucesso")


@router.post("/logout", response_model=LoginResponse)
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return LoginResponse(success=True, message="Sessão encerrada")


@router.get("/me")
async def me(admin_token: str = Cookie(default=None)):
    if not admin_token or not verify_admin_token(admin_token):
        raise HTTPException(status_code=401, detail="Não autenticado")
    return {"authenticated": True, "user": ADMIN_USER}

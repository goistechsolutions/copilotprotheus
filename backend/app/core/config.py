from dotenv import load_dotenv
from pydantic import BaseModel
import os
from typing import Optional

from app.core.secret_env import get_required_secret

load_dotenv(override=True)

class Settings(BaseModel):
    tenant_name: str = os.getenv("TENANT_NAME", "")
    protheus_rest_url: str = os.getenv("PROTHEUS_REST_URL", "")
    webapp_url: str = os.getenv("WEBAPP_URL", "")
    vscode_server_url: str = os.getenv("VSCODE_SERVER_URL", "")
    client_id: str = os.getenv("CLIENT_ID", "")
    client_secret: str = os.getenv("CLIENT_SECRET", "")
    protheus_user: str = os.getenv("PROTHEUS_USER", "")
    protheus_password: str = os.getenv("PROTHEUS_PASSWORD", "")
    auth_mode: str = os.getenv("AUTH_MODE", "basic")
    timeout_seconds: int = int(os.getenv("TIMEOUT_SECONDS", "30"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    ollama_url: str = os.getenv("OLLAMA_URL") or os.getenv("OLLAMA_BASE_URL") or "http://host.docker.internal:11434"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_URL") or "http://host.docker.internal:11434"
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
    ollama_auxiliary_model: str = os.getenv("OLLAMA_AUXILIARY_MODEL", "qwen2.5-coder:3b")
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    llm_backend: str = os.getenv("LLM_BACKEND", "ollama")
    jwt_secret: str = get_required_secret("JWT_SECRET")
    jwt_expiry_seconds: int = int(os.getenv("JWT_EXPIRY_SECONDS", "3600"))
    database_url: str = os.getenv("DATABASE_URL", "")
    cors_origin: str = os.getenv("CORS_ORIGIN", "")

    # Driver do banco Protheus ("oracle" ou "mssql")
    db_driver: str = os.getenv("DB_DRIVER", "oracle").lower()

    # Cloudflare R2
    r2_endpoint_url: Optional[str] = os.getenv("R2_ENDPOINT_URL")
    r2_access_key_id: Optional[str] = os.getenv("R2_ACCESS_KEY_ID")
    r2_secret_access_key: Optional[str] = os.getenv("R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str = os.getenv("R2_BUCKET_NAME", "copilot-knowledge")

    # Observabilidade (Sentry)
    sentry_dsn: Optional[str] = os.getenv("SENTRY_DSN")

settings = Settings()

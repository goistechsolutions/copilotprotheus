from dotenv import load_dotenv
from pydantic import BaseModel
import os
from typing import Optional

load_dotenv()

class Settings(BaseModel):
    tenant_name: str = os.getenv("TENANT_NAME", "pilot_rodolltda")
    protheus_rest_url: str = os.getenv("PROTHEUS_REST_URL", "https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest")
    webapp_url: str = os.getenv("WEBAPP_URL", "https://rodolltda195384.protheus.cloudtotvs.com.br:10703/webapp/index.html")
    vscode_server_url: str = os.getenv("VSCODE_SERVER_URL", "")
    client_id: str = os.getenv("CLIENT_ID", "")
    client_secret: str = os.getenv("CLIENT_SECRET", "")
    protheus_user: str = os.getenv("PROTHEUS_USER", "admin")
    protheus_password: str = os.getenv("PROTHEUS_PASSWORD", "Rodol2026@")
    auth_mode: str = os.getenv("AUTH_MODE", "basic")
    timeout_seconds: int = int(os.getenv("TIMEOUT_SECONDS", "30"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    ollama_url: str = os.getenv("OLLAMA_URL", "")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    llm_backend: str = os.getenv("LLM_BACKEND", "ollama")
    jwt_secret: str = os.getenv("JWT_SECRET", "copilot-protheus-dev-secret-change-me")
    jwt_expiry_seconds: int = int(os.getenv("JWT_EXPIRY_SECONDS", "3600"))
    database_url: str = os.getenv("DATABASE_URL", "")
    cors_origin: str = os.getenv("CORS_ORIGIN", "*")

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

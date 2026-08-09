import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

def require_env(name: str, min_len: int = 1) -> str:
    value = os.getenv(name, "").strip()
    if not value or len(value) < min_len:
        raise RuntimeError(
            f"Variável obrigatória ausente ou inválida: {name} "
            f"(mínimo {min_len} caracteres)."
        )
    return value

JWT_SECRET = require_env("JWT_SECRET", min_len=32)

def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)

_fernet = Fernet(_derive_fernet_key(JWT_SECRET))

def encrypt_password(password: str) -> str:
    if not password:
        return ""
    return _fernet.encrypt(password.encode("utf-8")).decode("utf-8")

def decrypt_password(encrypted_password: str) -> str:
    if not encrypted_password:
        return ""
    try:
        return _fernet.decrypt(encrypted_password.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        logger.warning(
            "decrypt_password: valor não é Fernet válido; assumindo "
            "texto claro (modo tolerante de migração)."
        )
        return encrypted_password

from cryptography.fernet import Fernet
import os

# Padrão seguro de desenvolvimento, deve ser configurada chave forte em produção via env var ENCRYPTION_KEY
_DEFAULT_KEY = b'uM89fWbPTRLagy7TuoqUg0mF5Y3ZnQ4hI4VIjIorN8l='
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "").encode("utf-8")

if not ENCRYPTION_KEY:
    ENCRYPTION_KEY = _DEFAULT_KEY

try:
    fernet = Fernet(ENCRYPTION_KEY)
except Exception:
    # Caso a chave informada não seja uma chave Fernet válida de 32 bytes em base64, faz fallback seguro
    import base64
    import hashlib
    key_32bytes = base64.urlsafe_b64encode(hashlib.sha256(ENCRYPTION_KEY).digest())
    fernet = Fernet(key_32bytes)

def encrypt_password(password: str) -> str:
    if not password:
        return ""
    return fernet.encrypt(password.encode("utf-8")).decode("utf-8")

def decrypt_password(encrypted_password: str) -> str:
    if not encrypted_password:
        return ""
    return fernet.decrypt(encrypted_password.encode("utf-8")).decode("utf-8")

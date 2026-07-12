import jwt
from datetime import datetime
from typing import Dict, Any, Optional
from app.core.config import settings

LICENSE_SECRET = settings.jwt_secret + "-license-key-salt"

def generate_license(cnpj: str, expiration_date: str, plan_level: str = "standard") -> str:
    """
    Gera um token JWT assinado contendo as informações da licença.
    expiration_date deve estar no formato YYYY-MM-DD.
    """
    # Converter expiração para timestamp UNIX (garante que apenas YYYY-MM-DD seja lido, ignorando a hora)
    date_str = expiration_date[:10] if "T" in expiration_date else expiration_date
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    payload = {
        "cnpj": cnpj,
        "exp": int(dt.timestamp()),
        "plan_level": plan_level,
        "generated_at": datetime.now().isoformat()
    }
    return jwt.encode(payload, LICENSE_SECRET, algorithm="HS256")

def verify_license(license_token: str, expected_cnpj: Optional[str] = None) -> Dict[str, Any]:
    """
    Verifica e decodifica a licença. Retorna as informações se válida.
    Lança exceções em caso de token inválido/expirado.
    """
    payload = jwt.decode(license_token, LICENSE_SECRET, algorithms=["HS256"])
    if expected_cnpj and payload.get("cnpj") != expected_cnpj:
        raise ValueError("O CNPJ da licença não corresponde ao CNPJ da empresa.")
    return payload

def is_license_active(license_token: Optional[str], cnpj: str) -> bool:
    """
    Verifica de forma booleana se a licença está ativa e correta.
    """
    if not license_token:
        return False
    try:
        verify_license(license_token, expected_cnpj=cnpj)
        return True
    except Exception:
        return False

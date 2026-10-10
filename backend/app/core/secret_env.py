"""Leitura obrigatória de segredos: sem fallback embutido no código (fail-fast)."""
import os

_WEAK_VALUES = {
    "super_seguro",
    "copilot-protheus-dev-secret-change-me",
    "elitecorp-admin-secret-change-in-prod",
    "changeme",
    "change-me",
    "secret",
}


def get_required_secret(name: str, min_len: int = 32) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Variável de ambiente obrigatória ausente: {name}")
    if len(value) < min_len:
        raise RuntimeError(f"{name} deve ter pelo menos {min_len} caracteres.")
    if value.lower() in _WEAK_VALUES:
        raise RuntimeError(f"{name} usa um valor conhecido/inseguro; gere um segredo aleatório.")
    return value

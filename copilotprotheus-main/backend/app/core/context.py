from dataclasses import dataclass
from fastapi import Request

@dataclass
class ProtheusContext:
    user: str | None = None
    module: str | None = None
    company: str | None = None
    branch: str | None = None
    environment: str | None = None
    station: str | None = None
    session_id: str | None = None


def parse_context(request: Request, payload=None) -> dict:
    headers = request.headers
    return {
        "tenant_id": getattr(payload, 'tenant_id', None) or headers.get('x-tenant-id') or "default",
        "user": getattr(payload, 'user', None) or headers.get('x-protheus-user'),
        "password": getattr(payload, 'password', None) or headers.get('x-protheus-password'),
        "protheus_token": getattr(payload, 'protheus_token', None) or headers.get('x-protheus-token'),
        "module": getattr(payload, 'module', None) or headers.get('x-protheus-module'),
        "company": getattr(payload, 'company', None) or headers.get('x-protheus-company'),
        "branch": getattr(payload, 'branch', None) or headers.get('x-protheus-branch'),
        "environment": getattr(payload, 'environment', None) or headers.get('x-protheus-environment'),
        "station": getattr(payload, 'station', None) or headers.get('x-protheus-station'),
        "session_id": getattr(payload, 'session_id', None) or headers.get('x-protheus-session-id'),
        "screen_text": getattr(payload, 'screen_text', None)
    }

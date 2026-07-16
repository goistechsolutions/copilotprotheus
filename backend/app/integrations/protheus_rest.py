import requests
from app.services.protheus_service import get_tenant_config

def ping_protheus(tenant_id: str = "default"):
    config = get_tenant_config(tenant_id)
    rest_url = config.get("rest_url", "")

    try:
        r = requests.get(f'{rest_url.rstrip("/")}/health', timeout=5, verify=False)
        return {'ok': True, 'status_code': r.status_code, 'body': r.text[:200]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

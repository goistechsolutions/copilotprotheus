from fastapi import APIRouter
from app.integrations.protheus_client import ProtheusClient
from app.core.settings import TENANT_NAME, WEBAPP_URL, VSCODE_SERVER_URL
from app.schemas.integration import ConnectionTestResponse
from app.services.protheus_service import get_tenant_config

router = APIRouter(prefix="/integration", tags=["integration"])

@router.get('/test', response_model=ConnectionTestResponse)
def test_connection(tenant_id: str = "default"):
    config = get_tenant_config(tenant_id)
    client = ProtheusClient(config.get("rest_url"), config.get("user"), config.get("password"), config.get("auth_mode", "basic"))
    try:
        r = client.ping()
        return ConnectionTestResponse(
            ok=True, tenant=tenant_id, rest_url=config.get("rest_url"), webapp_url=WEBAPP_URL, vscode_server_url=VSCODE_SERVER_URL,
            status_code=r.status_code, body_preview=r.text[:500]
        )
    except Exception as e:
        return ConnectionTestResponse(ok=False, tenant=tenant_id, rest_url=config.get("rest_url"), webapp_url=WEBAPP_URL, vscode_server_url=VSCODE_SERVER_URL, error=str(e))

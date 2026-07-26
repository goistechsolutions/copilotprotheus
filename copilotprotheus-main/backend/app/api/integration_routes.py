from fastapi import APIRouter
from app.integrations.protheus_client import ProtheusClient
from app.core.settings import TENANT_NAME, PROTHEUS_REST_URL, WEBAPP_URL, VSCODE_SERVER_URL
from app.schemas.integration import ConnectionTestResponse

router = APIRouter(prefix="/integration", tags=["integration"])

@router.get('/test', response_model=ConnectionTestResponse)
def test_connection():
    client = ProtheusClient()
    try:
        r = client.ping()
        return ConnectionTestResponse(
            ok=True, tenant=TENANT_NAME, rest_url=PROTHEUS_REST_URL, webapp_url=WEBAPP_URL, vscode_server_url=VSCODE_SERVER_URL,
            status_code=r.status_code, body_preview=r.text[:500]
        )
    except Exception as e:
        return ConnectionTestResponse(ok=False, tenant=TENANT_NAME, rest_url=PROTHEUS_REST_URL, webapp_url=WEBAPP_URL, vscode_server_url=VSCODE_SERVER_URL, error=str(e))

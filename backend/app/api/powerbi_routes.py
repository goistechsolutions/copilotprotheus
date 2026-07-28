"""Power BI Embedded — embed token + dataset refresh."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import httpx, os

router = APIRouter(prefix="/api/powerbi", tags=["powerbi"])

PBI_TENANT   = os.getenv("POWERBI_TENANT_ID", "")
PBI_CLIENT   = os.getenv("POWERBI_CLIENT_ID", "")
PBI_SECRET   = os.getenv("POWERBI_CLIENT_SECRET", "")
PBI_SCOPE    = "https://analysis.windows.net/powerbi/api/.default"
PBI_BASE     = "https://api.powerbi.com/v1.0/myorg"


async def _get_access_token() -> str:
    """Obtém token via Client Credentials (service principal)."""
    if not all([PBI_TENANT, PBI_CLIENT, PBI_SECRET]):
        raise HTTPException(503, "Power BI credentials não configuradas (POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET)")
    url = f"https://login.microsoftonline.com/{PBI_TENANT}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": PBI_CLIENT,
            "client_secret": PBI_SECRET,
            "scope": PBI_SCOPE,
        })
    r.raise_for_status()
    return r.json()["access_token"]


class EmbedRequest(BaseModel):
    workspace_id: str
    report_id: str
    dataset_id: Optional[str] = None


@router.post("/embed-token")
async def generate_embed_token(body: EmbedRequest):
    """Gera EmbedToken para renderizar relatório Power BI no frontend."""
    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{PBI_BASE}/groups/{body.workspace_id}/reports/{body.report_id}/GenerateToken"
    payload = {"accessLevel": "view"}
    if body.dataset_id:
        payload["datasetId"] = body.dataset_id
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload, headers=headers)
    if not r.is_success:
        raise HTTPException(r.status_code, r.text)
    data = r.json()
    return {
        "embed_token":   data.get("token"),
        "token_type":    data.get("tokenType", "Embed"),
        "expiration":    data.get("expiration"),
        "embed_url":     f"https://app.powerbi.com/reportEmbed?reportId={body.report_id}&groupId={body.workspace_id}",
        "report_id":     body.report_id,
        "workspace_id":  body.workspace_id,
    }


@router.post("/refresh/{workspace_id}/{dataset_id}")
async def refresh_dataset(workspace_id: str, dataset_id: str):
    """Dispara refresh de dataset Power BI."""
    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{PBI_BASE}/groups/{workspace_id}/datasets/{dataset_id}/refreshes"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=headers)
    if r.status_code not in (200, 202):
        raise HTTPException(r.status_code, r.text)
    return {"status": "refresh_triggered", "dataset_id": dataset_id}


@router.get("/workspaces")
async def list_workspaces():
    """Lista workspaces (grupos) disponíveis."""
    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{PBI_BASE}/groups", headers=headers)
    r.raise_for_status()
    return r.json().get("value", [])


@router.get("/workspaces/{workspace_id}/reports")
async def list_reports(workspace_id: str):
    """Lista relatórios de um workspace."""
    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{PBI_BASE}/groups/{workspace_id}/reports", headers=headers)
    r.raise_for_status()
    return r.json().get("value", [])

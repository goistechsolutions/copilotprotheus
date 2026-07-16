import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/infra", tags=["Infraestrutura"])

# --- Autenticação Simples de Admin (mesma lógica usada em outros routers admin) ---
def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    expected_key = os.getenv("JWT_SECRET", "default")
    if not x_admin_key or x_admin_key != expected_key:
        raise HTTPException(status_code=401, detail="Chave admin inválida ou ausente")
    return x_admin_key

class ServerActionRequest(BaseModel):
    action: str  # ex: "reboot", "poweron", "poweroff", "reset"

# ----------------- HETZNER CLOUD -----------------

@router.get("/hetzner/servers", dependencies=[Depends(verify_admin_key)])
async def get_hetzner_servers():
    token = os.getenv("HETZNER_API_TOKEN") or os.getenv("HETZNER-API-TOKEN")
    if not token:
        raise HTTPException(status_code=400, detail="HETZNER_API_TOKEN não configurado no .env")
    
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.hetzner.cloud/v1/servers", headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Erro na Hetzner: {response.text}")
        
        data = response.json()
        servers = []
        for srv in data.get("servers", []):
            servers.append({
                "id": srv["id"],
                "name": srv["name"],
                "status": srv["status"],
                "public_ip": srv["public_net"]["ipv4"]["ip"],
                "cores": srv["server_type"]["cores"],
                "memory": srv["server_type"]["memory"],
                "datacenter": srv["datacenter"]["name"]
            })
        return {"servers": servers}

@router.post("/hetzner/servers/{server_id}/action", dependencies=[Depends(verify_admin_key)])
async def perform_hetzner_action(server_id: int, req: ServerActionRequest):
    token = os.getenv("HETZNER_API_TOKEN") or os.getenv("HETZNER-API-TOKEN")
    if not token:
        raise HTTPException(status_code=400, detail="HETZNER_API_TOKEN não configurado no .env")
    
    valid_actions = ["reboot", "poweron", "poweroff", "reset", "shutdown"]
    if req.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Ação inválida. Use uma de: {valid_actions}")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        # Docs: POST https://api.hetzner.cloud/v1/servers/{id}/actions/{action}
        url = f"https://api.hetzner.cloud/v1/servers/{server_id}/actions/{req.action}"
        response = await client.post(url, headers=headers)
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=f"Erro na Hetzner: {response.text}")
        
        return {"message": f"Ação '{req.action}' iniciada com sucesso no servidor {server_id}."}

# ----------------- CLOUDFLARE -----------------

@router.post("/cloudflare/purge-cache", dependencies=[Depends(verify_admin_key)])
async def purge_cloudflare_cache():
    zone_id = os.getenv("CLOUDFLARE_ZONE_ID") or os.getenv("CLOUDFLARE-ZONE-ID")
    token = os.getenv("CLOUDFLARE_API_TOKEN") or os.getenv("CLOUDFLARE-API-TOKEN")
    
    if not zone_id or not token:
        raise HTTPException(status_code=400, detail="Variáveis CLOUDFLARE_ZONE_ID ou CLOUDFLARE_API_TOKEN ausentes no .env")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"purge_everything": True}
    
    async with httpx.AsyncClient() as client:
        url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
        response = await client.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Erro Cloudflare: {response.text}")
        
        return {"message": "Cache do Cloudflare limpo com sucesso! (Purge Everything)"}

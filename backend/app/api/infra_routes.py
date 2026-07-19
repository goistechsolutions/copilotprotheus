import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/infra", tags=["Infraestrutura"])

from app.api.admin_routes import verify_admin

class ServerActionRequest(BaseModel):
    action: str  # ex: "reboot", "poweron", "poweroff", "reset"

# ----------------- HETZNER CLOUD -----------------

@router.get("/hetzner/servers", dependencies=[Depends(verify_admin)])
async def get_hetzner_servers():
    from pathlib import Path
    import dotenv
    env_config = dotenv.dotenv_values(Path(".env"))
    token = env_config.get("HETZNER_API_TOKEN") or env_config.get("HETZNER-API-TOKEN")
    
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

@router.post("/hetzner/servers/{server_id}/action", dependencies=[Depends(verify_admin)])
async def perform_hetzner_action(server_id: int, req: ServerActionRequest):
    from pathlib import Path
    import dotenv
    env_config = dotenv.dotenv_values(Path(".env"))
    token = env_config.get("HETZNER_API_TOKEN") or env_config.get("HETZNER-API-TOKEN")
    
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

@router.post("/cloudflare/purge-cache", dependencies=[Depends(verify_admin)])
async def purge_cloudflare_cache():
    from pathlib import Path
    import dotenv
    env_config = dotenv.dotenv_values(Path(".env"))
    
    zone_id = env_config.get("CLOUDFLARE_ZONE_ID") or env_config.get("CLOUDFLARE-ZONE-ID")
    token = env_config.get("CLOUDFLARE_API_TOKEN") or env_config.get("CLOUDFLARE-API-TOKEN")
    
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

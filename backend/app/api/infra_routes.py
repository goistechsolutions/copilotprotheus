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
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.hetzner.cloud/v1/servers", headers=headers, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Erro na Hetzner: {response.text}")
            
            data = response.json()
            servers = []
            for srv in data.get("servers", []):
                public_net = srv.get("public_net", {})
                ipv4 = public_net.get("ipv4", {})
                ip = ipv4.get("ip") if ipv4 else None
                servers.append({
                    "id": srv.get("id"),
                    "name": srv.get("name"),
                    "status": srv.get("status"),
                    "public_ip": ip,
                    "cores": srv.get("server_type", {}).get("cores"),
                    "memory": srv.get("server_type", {}).get("memory"),
                    "datacenter": srv.get("datacenter", {}).get("name")
                })
            return {"servers": servers}
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Erro de conexão com a Hetzner: {str(e)}")

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

@router.get("/cloudflare/status", dependencies=[Depends(verify_admin)])
async def get_cloudflare_status():
    from pathlib import Path
    import dotenv
    env_config = dotenv.dotenv_values(Path(".env"))
    
    # Verifica R2
    r2_configured = bool(env_config.get("R2_ACCESS_KEY_ID") and env_config.get("R2_SECRET_ACCESS_KEY"))
    
    # Verifica CDN
    cdn_configured = bool(env_config.get("CLOUDFLARE_ZONE_ID") and env_config.get("CLOUDFLARE_API_TOKEN"))
    
    return {
        "r2_active": r2_configured,
        "cdn_active": cdn_configured
    }

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

# ----------------- MOTOR DE IA (OLLAMA) -----------------

@router.get("/ollama/status", dependencies=[Depends(verify_admin)])
async def get_ollama_status():
    from pathlib import Path
    import dotenv
    env_config = dotenv.dotenv_values(Path(".env"))
    
    ollama_url = env_config.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{ollama_url}/api/tags")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "online",
                    "models": [m.get("name") for m in data.get("models", [])]
                }
            else:
                return {"status": "error", "detail": f"Erro do Ollama: {response.status_code}"}
    except Exception as e:
        return {"status": "offline", "detail": str(e)}


# ----------------- MÉTRICAS E GOVERNANÇA DE TENANTS -----------------

@router.get("/metrics/tenants", dependencies=[Depends(verify_admin)])
async def get_tenants_metrics():
    from app.db.database import SessionLocal
    from sqlalchemy import text

    db = SessionLocal()
    try:
        query = text("""
            SELECT 
                tr.tenant_code,
                tr.tenant_name,
                tr.status,
                COALESCE(p.plan_name, 'Standard') AS plan_name,
                COALESCE(p.max_queries_day, 500) AS max_queries_day,
                COUNT(pal.id) AS queries_today
            FROM public.tenant_registry tr
            LEFT JOIN public.plans p ON tr.plan_code = p.plan_code
            LEFT JOIN public.platform_audit_log pal 
                   ON pal.tenant_code = tr.tenant_code 
                  AND pal.created_at >= CURRENT_DATE
            GROUP BY tr.tenant_code, tr.tenant_name, tr.status, p.plan_name, p.max_queries_day
            ORDER BY queries_today DESC
        """)
        rows = db.execute(query).fetchall()
        metrics = []
        for r in rows:
            metrics.append({
                "tenant_code": r[0],
                "tenant_name": r[1],
                "status": r[2],
                "plan_name": r[3],
                "max_queries_day": r[4],
                "queries_today": r[5],
                "remaining": max(0, r[4] - r[5])
            })
        return {"tenants": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar métricas dos tenants: {str(e)}")
    finally:
        db.close()

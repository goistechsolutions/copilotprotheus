import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/infra", tags=["Infraestrutura"])

from app.api.admin_routes import verify_admin

class ServerActionRequest(BaseModel):
    action: str  # ex: "reboot", "poweron", "poweroff", "reset"


@router.get("/status", dependencies=[Depends(verify_admin)])
def get_infra_status():
    """Retorna somente a saúde dos serviços, sem ler dados corporativos."""
    import os
    from sqlalchemy import text
    from app.db.database import SessionLocal

    services = {
        "FastAPI Backend": {"status": "online"},
        "OpenAI API": {
            "status": "configured" if os.getenv("OPENAI_API_KEY") else "unknown",
        },
    }

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        services["PostgreSQL"] = {"status": "healthy"}
        try:
            has_vector = db.execute(
                text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
            ).scalar()
            services["pgvector"] = {"status": "healthy" if has_vector else "degraded"}
        except Exception:
            services["pgvector"] = {"status": "unknown"}
    except Exception:
        services["PostgreSQL"] = {"status": "offline"}
        services["pgvector"] = {"status": "unknown"}
    finally:
        db.close()

    return {"services": services}


@router.get("/env", dependencies=[Depends(verify_admin)])
def get_sanitized_environment():
    """Retorna flags de configuração sem valores de tokens, senhas ou chaves."""
    import os

    secret_names = {
        "DATABASE_URL",
        "POSTGRES_PASSWORD",
        "JWT_SECRET",
        "ADMIN_JWT_SECRET",
        "OPENAI_API_KEY",
        "GEMINI_API_KEY",
        "FERNET_KEY",
        "HETZNER_API_TOKEN",
        "CLOUDFLARE_API_TOKEN",
        "R2_SECRET_ACCESS_KEY",
    }
    known_names = {
        "NODE_ENV",
        "LLM_BACKEND",
        "BACKEND_URL",
        "TENANT_HEADER_REQUIRED",
        "PROTHEUS_ENVIRONMENT",
    }
    env = [
        {"key": name, "value": "configured" if os.getenv(name) else "not_configured"}
        for name in sorted(secret_names)
    ]
    env.extend(
        {"key": name, "value": os.getenv(name, "not_configured")}
        for name in sorted(known_names)
    )
    return {"env": env}


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
            FROM public.tenants tr
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


# ----------------- LOGS DOS CONTAINERS -----------------

@router.get("/container-logs", dependencies=[Depends(verify_admin)])
async def get_container_logs(
    service: str = "backend",
    limit: int = 200,
    queryrest_only: bool = False,
):
    """Lê somente o relay de logs sanitizados montado pelo host Hetzner.

    O backend não acessa o Docker socket. O host deve gravar os logs em
    CONTAINER_LOG_DIR e montar esse diretório como read-only no container.
    """
    import os
    import re
    from pathlib import Path

    allowed_services = {"backend", "middleware", "frontend", "db", "cloudflared"}
    if service not in allowed_services:
        raise HTTPException(status_code=400, detail="Serviço de container não permitido.")
    limit = max(1, min(int(limit), 1000))
    log_dir = Path(os.getenv("CONTAINER_LOG_DIR", "/var/log/copilotprotheus"))
    log_file = log_dir / f"{service}.log"
    if not log_file.is_file():
        return {
            "service": service,
            "available": False,
            "source": "host_log_relay",
            "entries": [],
            "message": "Relay de logs do host não está disponível para este serviço.",
        }

    secret_pattern = re.compile(
        r"(?i)(authorization\s*[:=]\s*bearer\s+|(?:password|secret|token|api[_-]?key)\s*[:=]\s*)[^,\s}]+"
    )
    sql_pattern = re.compile(r"(?i)((?:cquery|_queryparam|query)\s*[:=])(?:[^,}]+)")
    queryrest_pattern = re.compile(r"(?i)queryrest|/queryrest/QueryRest")
    entries: list[dict[str, str]] = []
    try:
        lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()[-limit * 3:]
        for line in lines:
            if queryrest_only and not queryrest_pattern.search(line):
                continue
            sanitized = secret_pattern.sub(r"\1[REDACTED]", line)
            sanitized = sql_pattern.sub(r"\1[SQL_REDACTED]", sanitized)
            level = "ERROR" if re.search(r"(?i)\b(error|exception|failed|falha)\b", sanitized) else (
                "WARNING" if re.search(r"(?i)\b(warn|warning)\b", sanitized) else "INFO"
            )
            entries.append({"level": level, "message": sanitized})
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Não foi possível ler o relay de logs do host.") from exc

    return {
        "service": service,
        "available": True,
        "source": "host_log_relay",
        "queryrest_only": queryrest_only,
        "entries": entries[-limit:],
        "message": "Logs sanitizados; tokens, segredos e SQL foram removidos.",
    }


@router.get("/queryrest-diagnostic", dependencies=[Depends(verify_admin)])
async def get_queryrest_diagnostic_logs(limit: int = 200):
    """Atalho para filtrar eventos QueryRest no backend sem expor SQL."""
    return await get_container_logs(service="backend", limit=limit, queryrest_only=True)

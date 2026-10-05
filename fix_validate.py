with open('backend/app/api/agent_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

import re

idx1 = content.find('async def proxy_validate_context')
if idx1 != -1:
    idx2 = content.find('class AskAgentRequest', idx1)
    if idx2 != -1:
        new_fn = """async def proxy_validate_context(req: ValidateContextRequest, db: Session = Depends(get_db)):
    try:
        from app.services.protheus_queryrest_client import ProtheusQueryRestClient
        client = ProtheusQueryRestClient(
            db=db,
            tenant_code=req.tenant_id,
            environment_code=req.environment_code
        )
        res = await client.execute("SELECT 'OK' AS STATUS FROM DUAL")
        return {
            "ready": True, 
            "message": "Contexto validado via API V2 (QueryRest OK).",
            "environment": req.environment_code,
            "company": req.company,
            "branch": req.branch
        }
    except Exception as e:
        return {"ready": False, "message": f"Erro de integração (Cloud -> Protheus V2): {str(e)}"}

"""
        content = content[:idx1] + new_fn + content[idx2:]

idx3 = content.find('async def proxy_ask_agent')
if idx3 != -1:
    idx4 = content.find('\n\n', idx3)
    # The proxy_ask_agent in agent_routes.py is likely legacy, but since UI hits /agent/ask/v2 we might not need to touch proxy_ask_agent (which is /ask). Let's just fix proxy_validate_context.

with open('backend/app/api/agent_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

import asyncio
import jwt
import sys
from httpx import AsyncClient, ASGITransport
from app.main import app
from datetime import datetime, timedelta
import os

JWT_SECRET = os.getenv("JWT_SECRET", "copilot-protheus-dev-secret-change-me")
JWT_ALGORITHM = "HS256"

def create_token(tenant_id="rodol_prod", exp_minutes=60):
    return jwt.encode(
        {
            "tenant_id": tenant_id,
            "user_id": "test_user",
            "role": "admin",
            "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

async def run_tests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. No JWT -> 401
        print("Teste 1: Sem JWT")
        res = await client.post("/api/agent/ask/v2", json={"query": "test", "tenant_id": "rodol_prod", "environment_code": "test"})
        print(f"Status: {res.status_code} {res.json()}")
        
        # 2. Expired JWT -> 401
        print("\nTeste 2: JWT Expirado")
        expired_token = create_token(exp_minutes=-10)
        res = await client.post("/api/agent/ask/v2", json={"query": "test", "tenant_id": "rodol_prod", "environment_code": "test"}, headers={"Authorization": f"Bearer {expired_token}"})
        print(f"Status: {res.status_code} {res.json()}")
        
        # 3. Valid JWT, Divergent Tenant -> 403
        print("\nTeste 3: JWT Valido mas Tenant Divergente")
        valid_token = create_token("tenant_A")
        res = await client.post("/api/agent/ask/v2", json={"query": "test", "tenant_id": "tenant_B", "environment_code": "test"}, headers={"Authorization": f"Bearer {valid_token}"})
        print(f"Status: {res.status_code} {res.json()}")
        
        # 4. Valid JWT -> 200
        print("\nTeste 4: JWT Valido")
        valid_token = create_token("tenant_A")
        res = await client.post("/api/agent/ask/v2", json={"query": "test", "tenant_id": "tenant_A", "environment_code": "test"}, headers={"Authorization": f"Bearer {valid_token}"})
        print(f"Status: {res.status_code} {res.json()}")
        
        print("\nDone")

if __name__ == "__main__":
    asyncio.run(run_tests())

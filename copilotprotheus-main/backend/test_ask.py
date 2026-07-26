import httpx
import asyncio

async def test():
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post("http://127.0.0.1:8000/api/ask", json={
            "question": "O que é o sistema Protheus?",
            "user": "muril"
        }, headers={"X-Tenant-Id": "empresa_01_teste"})
        print(res.status_code)
        print(res.json())

if __name__ == "__main__":
    asyncio.run(test())

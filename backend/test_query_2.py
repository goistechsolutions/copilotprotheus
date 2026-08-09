import asyncio
import os
import sys

sys.path.append(os.path.abspath("C:/projeto/copilotprotheus/backend"))

from app.services.protheus_service import execute_protheus_tool

async def main():
    tenant = "rodol_prod"
    queries = [
        "SELECT COUNT(*) AS QTD FROM SX2010 WHERE D_E_L_E_T_ <> '*'",
        "SELECT COUNT(*) AS QTD FROM SX2990 WHERE D_E_L_E_T_ <> '*'",
        "SELECT DISTINCT X2_MODULO FROM SX2010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10",
        "SELECT DISTINCT X2_MODULO FROM SX2990 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10",
        "SELECT X2_CHAVE, X2_MODULO FROM SX2010 WHERE X2_CHAVE LIKE '%SC5%'",
        "SELECT X2_CHAVE, X2_MODULO FROM SX2990 WHERE X2_CHAVE LIKE '%SC5%'"
    ]
    for q in queries:
        print(f"\n--- QUERY: {q} ---")
        try:
            res = await execute_protheus_tool("QueryRest", {"cQuery": q}, tenant_id=tenant)
            print("RESULTADO:", res)
        except Exception as e:
            print("ERRO:", e)

if __name__ == "__main__":
    asyncio.run(main())

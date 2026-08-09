import asyncio
import os
import sys

# Adiciona o diretorio atual ao sys.path para importar app
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.services.protheus_service import execute_protheus_tool

async def main():
    tenant = "rodol_prod"
    
    queries = [
        # 1. Verifica quantas tabelas tem na SX2010
        "SELECT COUNT(*) AS QTD FROM SX2010 WHERE D_E_L_E_T_ <> '*'",
        
        # 2. Verifica quantas tabelas tem na SX2990 (Dicionario global)
        "SELECT COUNT(*) AS QTD FROM SX2990 WHERE D_E_L_E_T_ <> '*'",
        
        # 3. Amostra de modulos na SX2010
        "SELECT DISTINCT X2_MODULO FROM SX2010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10",
        
        # 4. Amostra de modulos na SX2990
        "SELECT DISTINCT X2_MODULO FROM SX2990 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10",
        
        # 5. Busca tabela SC5 (Pedidos de Venda - FAT) para ver qual é o X2_MODULO dela
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

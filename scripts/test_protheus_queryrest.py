import asyncio
import httpx
import argparse
import json
import urllib3
import ssl

# Desabilita avisos de certificado (comum em servidores Protheus sem SSL válido internamente)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

async def test_protheus_api(base_url, username, password, query):
    base_url = base_url.rstrip('/')
    
    print(f"=== TESTE DE INTEGRAÇÃO PROTHEUS REST ===")
    print(f"URL Base: {base_url}")
    print(f"Usuário: {username}")
    print(f"Query: {query}\n")

    # SSL Context que ignora verificação (similar ao verify=False do httpx)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    async with httpx.AsyncClient(verify=ssl_context, timeout=30) as client:
        # 1. OBTER TOKEN OAUTH2
        token_url = f"{base_url}/api/oauth2/v1/token"
        print(f"1. Solicitando Token OAuth2 em: {token_url}")
        try:
            token_response = await client.post(
                token_url,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "password",
                    "username": username,
                    "password": password,
                }
            )
            
            print(f"   Status HTTP OAuth2: {token_response.status_code}")
            
            if token_response.status_code >= 400:
                print(f"   FALHA: Não foi possível obter o token. Resposta: {token_response.text}")
                return

            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                print(f"   FALHA: Resposta HTTP 200, mas sem access_token. Resposta: {token_data}")
                return
                
            print("   [OK] Token obtido com sucesso! (comprimento:", len(access_token), ")\n")
            
        except Exception as e:
            print(f"   ERRO CRÍTICO na chamada OAuth2: {e}")
            return

        # 2. TESTAR O ENDPOINT QUERYREST
        query_url = f"{base_url}/QueryRest"
        print(f"2. Testando Endpoint QueryRest em: {query_url}")
        
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        # Vamos testar 3 variações de payload para descobrir qual o servidor aceita
        payloads_to_test = [
            {"nome": "Especificação Oficial (Apenas 'cQuery')", "payload": {"cQuery": query}},
            {"nome": "Especificação EliteCorp PDF (Apenas 'query')", "payload": {"query": query}},
            {"nome": "Ambos combinados", "payload": {"query": query, "cQuery": query}}
        ]

        for teste in payloads_to_test:
            print(f"\n--- Cenário: {teste['nome']} ---")
            print(f"   Payload enviado: {json.dumps(teste['payload'])}")
            try:
                response = await client.post(
                    query_url,
                    headers=headers,
                    json=teste['payload']
                )
                
                print(f"   Status HTTP QueryRest: {response.status_code}")
                
                if response.status_code >= 400:
                    print(f"   FALHA (AppServer Error): {response.text}")
                else:
                    try:
                        data = response.json()
                        print(f"   [SUCESSO] Resposta JSON:")
                        print(f"   {json.dumps(data)[:300]}... (truncado)")
                    except ValueError:
                        print(f"   [SUCESSO] Mas a resposta NÃO É JSON válido: {response.text[:300]}")
                        
            except Exception as e:
                print(f"   ERRO CRÍTICO na chamada QueryRest: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Testa a comunicação OAuth2 e QueryRest do Protheus")
    parser.add_argument("--url", required=True, help="URL Base REST do Protheus (ex: https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest)")
    parser.add_argument("--user", required=True, help="Usuário REST do Protheus")
    parser.add_argument("--password", required=True, help="Senha REST do Protheus")
    parser.add_argument("--query", default="SELECT 1 AS TESTE FROM DUAL", help="Query SQL para teste")
    
    args = parser.parse_args()
    
    asyncio.run(test_protheus_api(args.url, args.user, args.password, args.query))

import requests
import json
import sys

BASE_URL = "https://copilot.elitecorp.tec.br"
TOKEN_URL = f"{BASE_URL}/auth/token"
CHAT_URL = f"{BASE_URL}/chat/stream"

payload_token = {
    "user": "admin",
    "module": "PROTHEUS"
}

print("Obtendo token da URL publica do tunnel...")
try:
    token_resp = requests.post(TOKEN_URL, json=payload_token, timeout=10)
    token_resp.raise_for_status()
    token = token_resp.json().get('token')
    print(f"Token obtido com sucesso: {token[:20]}...")
except Exception as e:
    print(f"Erro ao obter token do tunnel: {e}")
    sys.exit(1)

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

payload = {
    "question": "qual o faturamento da filial 0101 no dia 30 de junho de 2026?",
    "history": [],
    "context": {
        "user": "admin",
        "module": "SIGAFAT",
        "company": "01",
        "branch": "0101",
        "environment": "validacao"
    }
}

print("Enviando pergunta via stream ao tunnel...")
try:
    # Como e uma rota de stream, vamos ler em chunks
    resp = requests.post(CHAT_URL, json=payload, headers=headers, stream=True, timeout=30)
    resp.raise_for_status()
    print("--- Resposta do Stream ---")
    for chunk in resp.iter_content(chunk_size=None):
        if chunk:
            print(chunk.decode('utf-8', errors='ignore'), end='', flush=True)
    print("\n--------------------------")
except Exception as e:
    print(f"\nErro ao consultar chat stream via tunnel: {e}")

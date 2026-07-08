import requests
import json
import sys

BACKEND_URL = "http://5.161.216.50:8000/api/ask"
TOKEN_URL = "http://5.161.216.50:3001/auth/token"

payload_token = {
    "user": "admin",
    "module": "PROTHEUS"
}

print("Obtendo token da middleware remota...")
try:
    token_resp = requests.post(TOKEN_URL, json=payload_token)
    token_resp.raise_for_status()
    token = token_resp.json().get('token')
    print(f"Token obtido com sucesso: {token[:20]}...")
except Exception as e:
    print(f"Erro ao obter token da middleware remota: {e}")
    sys.exit(1)

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

payload = {
    "question": "qual o faturamento da filial 0101 no dia 30 de junho de 2026?",
    "history": []
}

print("Enviando pergunta diretamente ao FastAPI remoto...")
try:
    resp = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    print("Status Code:", resp.status_code)
    print("--- Resposta do Backend Remoto ---")
    print(resp.json().get("answer"))
except Exception as e:
    print(f"Erro ao consultar backend remoto: {e}")

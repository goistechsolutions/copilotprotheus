import requests
import sys

BASE_URL = "https://copilot.elitecorp.tec.br"
TOKEN_URL = f"{BASE_URL}/auth/token"
CHAT_URL = f"{BASE_URL}/chat/stream"

# 1. Obtendo token JWT
payload_token = {
    "user": "custom_user",
    "module": "PROTHEUS",
    "tenant_id": "pilot_rodolltda"
}
token = requests.post(TOKEN_URL, json=payload_token).json().get('token')

# 2. Enviando pergunta e credenciais de login no Protheus
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
payload_chat = {
    "question": "Faturamento do dia 30/06/2026",
    "context": {
        "user": "admin",
        "password": "Rodol2026@",
        "module": "SIGAFAT",
        "company": "01",
        "branch": "0101",
        "environment": "validacao"
    }
}

print("Enviando chat com credenciais customizadas...")
chat_resp = requests.post(CHAT_URL, json=payload_chat, headers=headers, stream=True)
print("--- Resposta do Stream ---")
for chunk in chat_resp.iter_content(chunk_size=None):
    if chunk:
        print(chunk.decode('utf-8', errors='ignore'), end='', flush=True)
print("\n--------------------------")

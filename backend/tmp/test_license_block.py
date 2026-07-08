import requests
import sys

BASE_URL = "https://copilot.elitecorp.tec.br"
TOKEN_URL = f"{BASE_URL}/auth/token"
CHAT_URL = f"{BASE_URL}/chat/stream"

# 1. Obtendo token JWT para a middleware
payload_token = {
    "user": "admin",
    "module": "PROTHEUS",
    "tenant_id": "pilot_rodolltda"
}
token = requests.post(TOKEN_URL, json=payload_token).json().get('token')

# 2. Vamos chamar a API de criacao/atualizacao de empresas para setar uma licenca expirada!
# Primeiro, geramos um token expirado na nossa API do backend
admin_key = "g0mF5Y3ZnQ4hI4VIjIorN8lD4pSEvL4O8Zn9u3WoTZy9So5/fWbPTRLagy7TuoqU"
headers_admin = {
    "X-Admin-Key": admin_key,
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

# Gera uma licenca expirada (validade de ontem)
payload_gen = {
    "cnpj": "12345678000199",
    "expiration_date": "2026-07-04", # ontem (ja que hoje e 2026-07-05)
    "plan_level": "standard"
}
gen_resp = requests.post(f"{BASE_URL}/api/license/generate", json=payload_gen, headers=headers_admin)
if gen_resp.status_code != 200:
    print(f"Erro ao gerar licenca expirada: {gen_resp.text}")
    sys.exit(1)
    
expired_token = gen_resp.json().get("token")
print(f"Licenca expirada gerada: {expired_token[:30]}...")

# Atualiza a licenca da empresa ID 1 (RODOL Ltda)
payload_update = {
    "licenca_uso": expired_token
}
update_resp = requests.put(f"{BASE_URL}/api/companies/1", json=payload_update, headers={"Authorization": f"Bearer {token}"})
print(f"Update status: {update_resp.status_code}")

# 3. Envia pergunta via chat stream e valida se foi bloqueada!
headers_chat = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
payload_chat = {
    "question": "Faturamento de 30/06/2026",
    "context": {"user": "admin", "module": "SIGAFAT", "company": "01", "branch": "0101", "environment": "validacao"}
}

print("Enviando chat pos-bloqueio...")
chat_resp = requests.post(CHAT_URL, json=payload_chat, headers=headers_chat, stream=True)
print("--- Resposta do Stream ---")
for chunk in chat_resp.iter_content(chunk_size=None):
    if chunk:
        print(chunk.decode('utf-8', errors='ignore'), end='', flush=True)
print("\n--------------------------")

# 4. Restaurar a licenca valida para nao deixar quebrado!
print("Restaurando licenca valida...")
payload_gen_valid = {
    "cnpj": "12345678000199",
    "expiration_date": "2036-07-01", # 10 anos
    "plan_level": "premium"
}
valid_token = requests.post(f"{BASE_URL}/api/license/generate", json=payload_gen_valid, headers=headers_admin).json().get("token")
requests.put(f"{BASE_URL}/api/companies/1", json={"licenca_uso": valid_token}, headers={"Authorization": f"Bearer {token}"})
print("Licenca valida restaurada!")

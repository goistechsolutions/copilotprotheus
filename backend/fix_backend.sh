#!/bin/bash
# ============================================================
# SCRIPT DE CORREÇÃO - CopilotProtheus Backend
# Execute: bash fix_backend.sh
# Pré-requisito: cd /path/to/copilotprotheus/backend
# ============================================================

set -e

echo "========================================="
echo " CopilotProtheus - Aplicando Correções"
echo "========================================="

# ─── VERIFICAÇÕES INICIAIS ────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "[OK] Arquivo .env criado a partir de .env.example"
  else
    echo "ERRO: .env não encontrado. Execute na pasta backend/"
    exit 1
  fi
fi

cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "[OK] Backup do .env criado."

# ─── CORREÇÃO 1: Gerar chaves seguras ─────────────────────────
echo ""
echo "[1/5] Gerando chaves criptográficas seguras..."
NEW_FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
NEW_JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || echo "")
NEW_ADMIN_JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || echo "")

# ─── CORREÇÃO 2: Atualizar .env com chaves seguras ────────────
echo ""
echo "[2/5] Atualizando .env com variáveis seguras e faltantes..."

set_env_var() {
  local KEY="$1"
  local VALUE="$2"
  if [ -z "$VALUE" ]; then return; fi
  if grep -q "^${KEY}=" .env; then
    CUR_VAL=$(grep "^${KEY}=" .env | cut -d'=' -f2-)
    if [ -z "$CUR_VAL" ] || [[ "$CUR_VAL" == *"change"* ]] || [[ "$CUR_VAL" == *"sua_chave"* ]]; then
      sed -i.bak "s|^${KEY}=.*|${KEY}=${VALUE}|" .env
      rm -f .env.bak
    fi
  else
    echo "${KEY}=${VALUE}" >> .env
  fi
}

if [ -n "$NEW_FERNET_KEY" ]; then set_env_var "ENCRYPTION_KEY" "${NEW_FERNET_KEY}"; fi
if [ -n "$NEW_JWT_SECRET" ]; then set_env_var "JWT_SECRET" "${NEW_JWT_SECRET}"; fi
if [ -n "$NEW_ADMIN_JWT_SECRET" ]; then set_env_var "ADMIN_JWT_SECRET" "${NEW_ADMIN_JWT_SECRET}"; fi

set_env_var "TIMEOUT_SECONDS" "120"

echo "[OK] .env atualizado com sucesso."

# ─── CORREÇÃO 3: Verificar variáveis obrigatórias ─────────────
echo ""
echo "[3/5] Verificando variáveis obrigatórias..."
MISSING=0
for VAR in DATABASE_URL GEMINI_API_KEY R2_ENDPOINT_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  VAL=$(grep "^${VAR}=" .env | cut -d'=' -f2- | tr -d "'\"")
  if [ -z "$VAL" ] || [[ "$VAL" == *"sua_chave"* ]] || [[ "$VAL" == *"change"* ]]; then
    echo "  [AVISO] ${VAR} está vazio ou com valor padrão — configure manualmente!"
    MISSING=$((MISSING + 1))
  else
    echo "  [OK] ${VAR} está configurado."
  fi
done

echo ""
echo "========================================="
echo " ✅ Script de correções concluído!"
echo "========================================="

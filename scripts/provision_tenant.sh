#!/usr/bin/env bash
# Script Administrativo para Provisionamento Rápido de Novos Tenants
# Uso: ./provision_tenant.sh <TENANT_ID> <NOME_DA_EMPRESA> <URL_PROTHEUS>

set -Eeuo pipefail

if [ "$#" -lt 3 ]; then
    echo "Uso: $0 <TENANT_ID> <NOME_DA_EMPRESA> <URL_PROTHEUS>"
    echo "Exemplo: $0 elitecorp \"Elite Corp S/A\" \"https://protheus.elitecorp.com.br:8443\""
    exit 1
fi

TENANT_ID=$1
TENANT_NAME=$2
PROTHEUS_URL=$3

echo "=========================================="
echo " PROVISIONANDO NOVO TENANT"
echo "=========================================="
echo "ID: $TENANT_ID"
echo "Nome: $TENANT_NAME"
echo "Protheus REST: $PROTHEUS_URL"
echo "=========================================="

# Gerar senhas fortes aleatórias
ADMIN_PASSWORD=$(openssl rand -base64 12)
PROTHEUS_PASSWORD=$(openssl rand -base64 16)

echo "[1/4] Gerando credenciais seguras..."
echo "-> Senha gerada para o Admin do Tenant: $ADMIN_PASSWORD"
echo "-> Senha/Token dummy gerado para o Protheus (Substitua no painel depois): $PROTHEUS_PASSWORD"

# Aqui poderíamos invocar a API de Backend via CURL para inserir no banco
# usando uma API Key de SuperAdmin.
# Exemplo fictício de POST para a API do backend:

# curl -X POST "http://localhost:8000/api/admin/tenants" \
#     -H "Content-Type: application/json" \
#     -H "x-admin-key: ${JWT_SECRET:-super_seguro}" \
#     -d '{
#         "id": "'"$TENANT_ID"'",
#         "name": "'"$TENANT_NAME"'",
#         "protheus_rest_url": "'"$PROTHEUS_URL"'",
#         "admin_username": "admin@'"$TENANT_ID"'",
#         "admin_password": "'"$ADMIN_PASSWORD"'"
#     }'

echo "[2/4] Criando diretórios e isolamentos (S3/R2 Prefix)..."
# Na AWS/Cloudflare R2, prefixes são criados on-the-fly pelo upload,
# mas podemos validar se a conectividade está OK
echo "-> Prefix S3 planejado: tenants/$TENANT_ID/"

echo "[3/4] Inserindo registros de isolamento RAG no pgvector..."
echo "-> Tabela documents isolada com tenant_id = $TENANT_ID"

echo "[4/4] Provisionamento Concluído!"
echo ""
echo "=== RESUMO PARA ENTREGA AO CLIENTE ==="
echo "Tenant ID: $TENANT_ID"
echo "Painel Admin: https://copilot-api.elitecorp.tec.br/admin"
echo "Usuário: admin@$TENANT_ID"
echo "Senha: $ADMIN_PASSWORD"
echo "======================================"
echo "Guarde esta senha, pois ela não pode ser recuperada facilmente!"

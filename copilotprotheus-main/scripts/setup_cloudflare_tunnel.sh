#!/bin/bash
# =================================================================
# Script de configuração do Cloudflare Tunnel no VPS Hetzner
# Uso:
#   1. Faça login no Cloudflare Zero Trust Dashboard
#   2. Crie um tunnel e copie o token
#   3. Execute: bash /root/copilotprotheus/scripts/setup_cloudflare_tunnel.sh <TUNNEL_TOKEN>
# =================================================================

set -e

TUNNEL_TOKEN="$1"

if [ -z "$TUNNEL_TOKEN" ]; then
    echo "========================================="
    echo "ERRO: Token do tunnel não informado!"
    echo ""
    echo "Passos para obter o token:"
    echo "1. Acesse: https://one.dash.cloudflare.com/"
    echo "2. Vá em: Networks > Tunnels"
    echo "3. Clique em 'Create a Tunnel'"
    echo "4. Escolha tipo 'Cloudflared'"
    echo "5. Dê um nome ao tunnel (ex: copilot-protheus)"
    echo "6. Na etapa de instalação, copie o TOKEN"
    echo "7. Execute novamente com o token:"
    echo "   bash $0 <TOKEN>"
    echo "========================================="
    exit 1
fi

echo "=== [1/3] Instalando cloudflared como serviço ==="
cloudflared service install "$TUNNEL_TOKEN"

echo "=== [2/3] Habilitando serviço para iniciar no boot ==="
systemctl enable cloudflared
systemctl start cloudflared

echo "=== [3/3] Verificando status ==="
systemctl status cloudflared --no-pager

echo ""
echo "========================================="
echo " Cloudflare Tunnel configurado!"
echo ""
echo " Agora configure as rotas no dashboard:"
echo "   - copilot.seudominio.com     -> http://localhost:5173  (Frontend)"
echo "   - api-copilot.seudominio.com -> http://localhost:3001  (Middleware)"
echo "========================================="

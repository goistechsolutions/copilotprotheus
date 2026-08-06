#!/bin/bash
# ============================================================
# Script: install-cloudflared.sh
# Descrição: Instala e configura o Cloudflare Tunnel (cloudflared)
# Projeto: CopilotProtheus - EliteCorp
# ============================================================

set -e

TOKEN="eyJhIjoiNmMzNjg4YjE5ZjNiN2E3NGE0ZTVlNjE0NWFjMTU1OTMiLCJ0IjoiNDVhMTIxYTItZjUyMi00YmJmLTgxNzctOTQ3YjAwYTZlMmE5IiwicyI6IlpHTmlOV1psWVRndE5qUmlOQzAwWTJJMExUZ3paRFV0TmpNell6Tm1Namt4TVdZMiJ9"

echo "======================================"
echo " Cloudflare Tunnel - Instalação"
echo "======================================"

# 1. Parar e remover serviço antigo se existir
echo "[1/6] Limpando instalação anterior..."
systemctl stop cloudflared 2>/dev/null || true
systemctl disable cloudflared 2>/dev/null || true
rm -f /etc/systemd/system/cloudflared.service
rm -f /etc/cloudflared/token
rm -f /etc/cloudflared/config.yml
rm -f /etc/cloudflared/*.json
systemctl daemon-reload

# 2. Instalar cloudflared
echo "[2/6] Instalando cloudflared..."
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb
rm -f /tmp/cloudflared.deb
echo "Versão instalada: $(cloudflared --version)"

# 3. Criar diretório e salvar token
echo "[3/6] Salvando token..."
mkdir -p /etc/cloudflared
echo -n "$TOKEN" > /etc/cloudflared/token
chmod 600 /etc/cloudflared/token

# 4. Criar arquivo de serviço systemd
echo "[4/6] Criando serviço systemd..."
cat > /etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel client
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=15
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token ${TOKEN}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# 5. Habilitar e iniciar o serviço
echo "[5/6] Iniciando serviço..."
systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

# 6. Verificar status
echo "[6/6] Verificando status..."
sleep 5
systemctl status cloudflared --no-pager -l

echo ""
echo "======================================"
echo " Instalação concluída!"
echo " Túnel: 45a121a2-f522-4bbf-8177-947b00a6e2a9"
echo " Host:  copilot.elitecorp.tec.br -> localhost:3001"
echo "======================================"

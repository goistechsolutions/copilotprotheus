#!/usr/bin/env bash
# Script para configurar o Ollama/IPEX-LLM como serviço do systemd na Hetzner (Ubuntu/Debian)
# Executar como root

set -e

echo "Criando arquivo de serviço systemd para o Ollama..."

cat << 'EOF' > /etc/systemd/system/ollama.service
[Unit]
Description=Ollama Local AI Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
# Ajuste o path do executável conforme a instalação real (ex: /usr/local/bin/ollama ou path do ipex-llm)
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_MODELS=/root/.ollama/models"
# Adicione variáveis do IPEX-LLM aqui se necessário:
# Environment="SYCL_CACHE_PERSISTENT=1"
# Environment="ZES_ENABLE_SYSMAN=1"

[Install]
WantedBy=multi-user.target
EOF

echo "Recarregando daemon do systemd..."
systemctl daemon-reload

echo "Habilitando Ollama para iniciar no boot..."
systemctl enable ollama.service

echo "Iniciando o serviço Ollama..."
systemctl start ollama.service

echo "Status do serviço:"
systemctl status ollama.service --no-pager

echo "Concluído! Ollama configurado com systemd."

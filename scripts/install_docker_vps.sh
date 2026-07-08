#!/bin/bash
set -e

echo "=== [1/3] Atualizando repositorios e pacotes basicos ==="
apt-get update
apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release

echo "=== [2/3] Adicionando chave oficial do Docker ==="
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update

echo "=== [3/3] Instalando Docker CE & Docker Compose Plugin ==="
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Criando link simbolico para o docker-compose padrao
ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

echo "=== Validando instalacao ==="
docker --version
docker-compose version
echo "=== Instalacao concluida! ==="

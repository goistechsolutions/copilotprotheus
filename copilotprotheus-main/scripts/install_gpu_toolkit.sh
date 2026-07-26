#!/bin/bash
# =============================================================================
# install_gpu_toolkit.sh
# Script de automação para instalação de drivers NVIDIA e NVIDIA Container Toolkit
# no Ubuntu 22.04 LTS (Azure NC Series)
# =============================================================================

set -e

echo "=== [1/4] Atualizando pacotes do sistema ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== [2/4] Instalando drivers NVIDIA oficiais ==="
sudo apt-get install -y ubuntu-drivers-common
sudo ubuntu-drivers install

echo "=== [3/4] Configurando repositório do NVIDIA Container Toolkit ==="
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update

echo "=== [4/4] Instalando NVIDIA Container Toolkit ==="
sudo apt-get install -y nvidia-container-toolkit

echo "=== Reiniciando o serviço do Docker ==="
sudo systemctl restart docker

echo "=== Instalação Concluída com Sucesso! ==="
echo "Por favor, reinicie a máquina virtual executando: sudo reboot"
echo "Após reiniciar, valide a GPU rodando: sudo docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi"

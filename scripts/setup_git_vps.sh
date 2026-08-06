#!/bin/bash
# ============================================================
# Script: setup_git_vps.sh
# Descrição: Configura acesso SSH ao GitHub e clona o repo
#            copilotprotheus na VPS - EliteCorp
# Uso: bash setup_git_vps.sh
# ============================================================

set -e

GITHUB_USER="goistechsolutions"
REPO_NAME="copilotprotheus"
REPO_DIR="/opt/copilotprotheus"
SSH_KEY="/root/.ssh/id_ed25519_github"

echo "======================================"
echo " Setup Git + Deploy - EliteCorp VPS"
echo "======================================"

# 1. Instalar dependências
echo "[1/6] Instalando dependências..."
apt-get update -qq
apt-get install -y git curl openssh-client

# 2. Gerar chave SSH para GitHub
echo "[2/6] Gerando chave SSH..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [ ! -f "$SSH_KEY" ]; then
  ssh-keygen -t ed25519 -C "vps@elitecorp.tec.br" -f "$SSH_KEY" -N ""
  echo "Chave gerada com sucesso!"
else
  echo "Chave SSH já existe, reutilizando..."
fi

# 3. Configurar SSH para usar a chave no GitHub
cat > /root/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/id_ed25519_github
  StrictHostKeyChecking no
EOF
chmod 600 /root/.ssh/config

# 4. Exibir chave pública para adicionar no GitHub
echo ""
echo "============================================================"
echo " IMPORTANTE: Adicione esta chave pública no GitHub"
echo " GitHub → Settings → SSH and GPG Keys → New SSH Key"
echo "============================================================"
echo ""
cat "${SSH_KEY}.pub"
echo ""
echo "============================================================"
echo " Pressione ENTER após adicionar a chave no GitHub..."
read -r

# 5. Testar conexão com GitHub
echo "[5/6] Testando conexão com GitHub..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  echo "✅ Conexão com GitHub OK!"
else
  echo "⚠️  Aviso: Verificar autenticação, mas continuando..."
fi

# 6. Clonar ou atualizar o repositório
echo "[6/6] Clonando/atualizando repositório..."
if [ -d "$REPO_DIR/.git" ]; then
  echo "Repositório já existe. Atualizando..."
  cd "$REPO_DIR"
  git pull origin main
else
  echo "Clonando repositório..."
  git clone git@github.com:${GITHUB_USER}/${REPO_NAME}.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

echo ""
echo "======================================"
echo " ✅ Setup concluído!"
echo " Repo: $REPO_DIR"
echo " Branch: $(git branch --show-current)"
echo " Último commit: $(git log --oneline -1)"
echo "======================================"
echo ""
echo "Próximo passo - instalar o cloudflared:"
echo "  bash $REPO_DIR/scripts/install-cloudflared.sh"
echo ""

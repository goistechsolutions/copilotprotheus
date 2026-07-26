# Guia de Implantação — Copilot Protheus em VM com GPU (Azure)

Este guia descreve os passos exatos para instalar os drivers da GPU NVIDIA, configurar o Docker com aceleração de hardware e migrar o projeto do seu computador local para a máquina virtual na Azure.

---

## 🚀 Passo 1: Preparar a VM na Azure (Ubuntu 22.04 LTS)

Após criar ou redimensionar sua VM na Azure para um tamanho com GPU (série **NC**), execute os comandos abaixo dentro do terminal da VM (via SSH) para instalar os drivers de vídeo e o **NVIDIA Container Toolkit**:

### 1. Instalar os Drivers Oficiais NVIDIA
```bash
sudo apt-get update
sudo apt-get install -y ubuntu-drivers-common
sudo ubuntu-drivers install
```

### 2. Adicionar o Repositório do NVIDIA Container Toolkit
```bash
# Adiciona a chave GPG do repositório oficial
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

# Configura a lista de fontes
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
```

### 3. Instalar o Toolkit e reiniciar o Docker
```bash
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 4. Validar se a GPU está visível no Docker
```bash
sudo docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
```
> [!NOTE]
> Se o comando acima exibir a tabela da GPU NVIDIA com o uso de memória e temperatura, a máquina virtual está pronta!

---

## 🐳 Passo 2: Iniciar o Ollama com Aceleração de GPU

Na VM, inicialize o container do Ollama passando o acesso direto à placa de vídeo:

```bash
sudo docker run -d \
  --gpus all \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --restart always \
  --name ollama \
  ollama/ollama
```

### Baixar o modelo Qwen no servidor:
```bash
sudo docker exec -it ollama ollama run qwen2.5:3b
```

---

## 📂 Passo 3: Migrar a Aplicação Completa do Local para a VM

### 1. Atualizar a URL no `.env` do Backend
No seu computador local, edite o arquivo [`backend/.env`](file:///C:/projeto/copilotprotheus/backend/.env) e configure o IP público definitivo da sua nova VM:
```env
LLM_BACKEND=ollama
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_URL=http://<IP-PUBLICO-DA-SUA-VM-GPU>:11434
```

### 2. Copiar os Arquivos Locais para a VM Azure
Abra o PowerShell na sua máquina local e use o comando **SCP** (substituindo o IP e apontando para a chave correta):

```powershell
# Execute na pasta raiz do projeto (c:\projeto\copilotprotheus)
scp -r -i .\key\copilot_key.pem .\* azureuser@<IP-PUBLICO-DA-SUA-VM-GPU>:/home/azureuser/copilotprotheus
```

---

## ⚡ Passo 4: Subir a Stack Completa na Nuvem (Azure)

Conecte-se na VM via SSH:
```powershell
ssh -i .\key\copilot_key.pem azureuser@<IP-PUBLICO-DA-SUA-VM-GPU>
```

Navegue até a pasta copiada e suba os containers do projeto em segundo plano:
```bash
cd /home/azureuser/copilotprotheus
sudo docker-compose up -d --build
```

Isso inicializará toda a sua aplicação SaaS:
- **Frontend** na porta `5173`
- **Middleware** na porta `3001`
- **Backend FastAPI** na porta `8000`
- **Banco de Dados Postgres (pgvector)** na porta `5435`

Para verificar se tudo está rodando em nuvem com sucesso:
```bash
sudo docker-compose ps
```

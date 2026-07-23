# Memória e Estado do Projeto: Copilot Protheus
**Data da última atualização:** 23 de Julho de 2026

Este documento é o **mapa definitivo e validado** da infraestrutura, arquitetura e topologia do Copilot Protheus. Ele reflete com 100% de precisão o ambiente em produção, detalhando onde cada componente roda, como eles se conectam e quais os procedimentos exatos de deploy.

---

## 1. Topologia da Arquitetura (Onde as coisas realmente rodam)

A arquitetura do projeto é híbrida, utilizando hospedagem estática serverless (Cloudflare Pages) e computação dedicada em nuvem (VPS Hetzner) com orquestração Docker.

### 1.1. Interface de Usuário / Chat (`/frontend`)
*   **Hospedagem:** Cloudflare Pages (Serverless)
*   **Domínios:** `copilot.elitecorp.tec.br`
*   **Como funciona:** Este é o frontend que o usuário final acessa para conversar com a IA. O Cloudflare lê a branch `main` do GitHub e executa o comando `npm run build` na pasta `/frontend` automaticamente a cada novo *commit*. 
*   **Troubleshooting:** Se a tela do chat não atualizar após um *commit*, o problema está na aba "Workers e Pages" do Cloudflare, que pode ter perdido a permissão de ler o repositório do Github.

### 1.2. Painel Administrativo / Protheus Control (`/admin-frontend`)
*   **Hospedagem:** VPS Dedicada (Hetzner) - via Docker (Container: `copilot-protheus-admin-frontend`)
*   **Porta Interna:** `5174` (Nginx)
*   **Domínio:** `copilot-api.elitecorp.tec.br/admin`
*   **Como funciona:** O painel de administração não roda no Cloudflare Pages. Ele é compilado e servido estaticamente pelo Nginx de dentro da VPS da Hetzner. O roteamento para o mundo externo é feito magicamente pelo Cloudflare Tunnel.
*   **Deploy Manual:** Qualquer alteração no código do admin exige acessar a VPS via SSH, puxar o código e recompilar o container:
    ```bash
    git pull origin main
    docker-compose build --no-cache admin-frontend
    docker-compose up -d admin-frontend
    ```

### 1.3. Backend IA e RAG (`/backend`)
*   **Hospedagem:** VPS Dedicada (Hetzner) - via Docker (Container: `copilot-protheus-backend`)
*   **Porta Interna:** `8000` (FastAPI/Uvicorn)
*   **Tecnologia:** Python, FastAPI, LangChain, LlamaIndex, SQLAlchemy.
*   **Domínio:** `copilot-api.elitecorp.tec.br/api`
*   **Como funciona:** Recebe as chamadas do Chat, gerencia os embeddings, consulta o banco de vetores e toma a decisão se o LLM vai acionar o Protheus (via Middleware) ou se vai responder com a Base de Conhecimento RAG.

### 1.4. Middleware de Resiliência TOTVS (`/middleware`)
*   **Hospedagem:** VPS Dedicada (Hetzner) - via Docker (Container: `copilot-protheus-middleware`)
*   **Porta Interna:** `3001` (Node.js/Express)
*   **Como funciona:** Fica escondido atrás do backend e não tem acesso público à internet. Sua única função é receber pedidos estruturados do Backend, envelopar no padrão TOTVS, aplicar enriquecimento de dados e enviar via VPN/IP fixo para os endpoints AdvPL REST dentro do ERP do cliente.

### 1.5. Banco de Dados Vectorial (`/db`)
*   **Hospedagem:** VPS Dedicada (Hetzner) - via Docker (Container: `copilot-protheus-db`)
*   **Porta Mapeada:** `5435`
*   **Tecnologia:** PostgreSQL 16 + extensão `pgvector`.
*   **Acesso Visual:** `http://[IP-DA-HETZNER]:8080` (Adminer).

---

## 2. Motor de Inteligência Artificial Local (Ollama / IPEX-LLM)

Uma das maiores premissas do sistema é a capacidade de rodar IA localmente para garantir confidencialidade dos dados do ERP, operando como backup ou motor principal.

*   **Onde o Ollama roda:** **NATIVAMENTE NO SISTEMA OPERACIONAL (LINUX) DA HETZNER.**
*   **Ele está no Docker?** **NÃO.** Ele não deve ser orquestrado via `docker-compose`. Ele roda no Linux *host* para extrair a máxima aceleração de hardware (ex: Intel GPUs via IPEX-LLM ou drivers diretos da placa).
*   **Como o Backend conversa com ele:** Como o backend está preso no Docker e o Ollama está solto no Linux (porta 11434), a configuração de variável de ambiente no Painel Administrativo deve **obrigatoriamente** ser apontada para a ponte nativa do docker:
    `OLLAMA_BASE_URL=http://host.docker.internal:11434`
*   **Comandos úteis do Ollama na VPS (SSH):**
    ```bash
    # Ver status
    ollama ps
    
    # Baixar novo modelo
    ollama run gemma:2b
    ```

---

## 3. Cloudflare Tunnel (O Guarda-Costas)

A VPS da Hetzner não precisa abrir nenhuma porta no Firewall (8000, 5174, etc) para a internet. 
A mágica acontece pelo container `copilot-protheus-cloudflared` configurado no `docker-compose.yml`. Ele abre um túnel criptografado reverso de dentro do servidor para a rede mundial da Cloudflare.
É a Cloudflare quem redireciona todo o tráfego seguro (`https://copilot-api.elitecorp.tec.br`) para os containers corretos lá dentro.

---

## 4. Estrutura Padrão de Chaves e Variáveis (Environment)

As variáveis sensíveis ficam salvas no container backend. O painel administrativo atualiza este arquivo ativamente. O setup base requer:

**Backend (`backend/.env`)**
```ini
LLM_BACKEND=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=xxx

# Comunicação local Host-Docker
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gemma3:1b

# R2 para base RAG
R2_ENDPOINT_URL=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=copilot-knowledge

# CDN Purge
CLOUDFLARE_ZONE_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# Status Hetzner (Monitoramento via UI)
HETZNER_API_TOKEN=xxx

# PostgreSQL
DATABASE_URL=postgresql://postgres:sap_password_123@db:5432/copilot_protheus
DB_DRIVER=oracle
JWT_SECRET=super_seguro
```

---

## 5. Resumo de Comandos de Sobrevivência (VPS)

```bash
# Atualizar TODO o projeto na VPS (Backend, Admin, Middleware)
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Ver os logs do Backend ao vivo (Útil para debugar as chamadas do RAG e Ollama)
docker-compose logs -f backend

# Reiniciar um serviço rapidamente (ex: Backend)
docker-compose restart backend
```

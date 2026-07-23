# Memória e Estado do Projeto: Copilot Protheus
**Data da última atualização:** 23 de Julho de 2026

Este documento serve como a **cópia de segurança descritiva do estado atual (Memória Base)** do sistema. O objetivo é permitir que qualquer engenheiro, equipe ou IA entenda instantaneamente a arquitetura completa do projeto caso seja necessário migrá-lo de plataforma, subir em um novo servidor ou retomar o desenvolvimento do zero.

---

## 1. Visão Geral da Solução
O **Copilot Protheus** é um ecossistema de assistente virtual (IA) integrado diretamente ao ERP TOTVS Protheus. Ele permite que usuários façam perguntas em linguagem natural e recebam respostas estruturadas baseadas nos dados em tempo real da empresa (Financeiro, Comercial, Contábil) ou de bases de conhecimento documentais (RAG).

A solução é baseada em microsserviços, 100% containerizada via Docker, e estruturada para rodar tanto On-Premise quanto em VPS Cloud (como Hetzner).

---

## 2. Topologia de Microsserviços e Diretórios

O repositório está subdividido nos seguintes serviços principais:

### 2.1 Backend (Python / FastAPI)
- **Caminho:** `/backend`
- **Função:** Coração da aplicação. Gerencia a lógica do LLM, geração de embeddings, banco de dados (Tenants, Empresas), e expõe a API para os frontends.
- **Porta:** `8000`
- **Tecnologias:** FastAPI, SQLAlchemy, LangChain/LlamaIndex.
- **Destaques de Código:**
  - `app/api/admin_routes.py`: Autenticação e painel de controle (gerência do `.env`).
  - `app/api/infra_routes.py`: Comunicação com Hetzner, Cloudflare e healthcheck do Ollama.
  - LLM configurável para rodar com o motor Google Gemini ou Ollama (local).

### 2.2 Middleware (Node.js / Express)
- **Caminho:** `/middleware`
- **Função:** Ponte de resiliência entre a IA e o ERP TOTVS Protheus. 
- **Porta:** `3001`
- **Tecnologias:** Node.js, Express, Axios.
- **Destaques de Código:**
  - Extrai intenções (`intentClassifier.js`), enriquece os dados (`protheusEnricher.js`) e lida com requests concorrentes sem travar a thread.
  - Lê cabeçalhos customizados (`x-admin-key`, `x-tenant-id`) sem credenciais fixadas (Padrão Sênior).

### 2.3 Protheus Control (React / Vite) - Painel Administrativo
- **Caminho:** `/admin-frontend`
- **Função:** Dashboard visual para administração total do ecossistema. 
- **Porta (Externa):** `5174`
- **Destaques de Código:**
  - Gerenciamento de Empresas, Configurações `.env`, Motor de IA (Gemini/Ollama) e Monitoramento de Infra (Hetzner/Cloudflare).
  - Componentização baseada em Axios, extraindo chaves do Vite envs (`VITE_ADMIN_USER`).

### 2.4 Interface do Usuário Chat (React / Vite)
- **Caminho:** `/frontend`
- **Função:** A tela de chat por onde o usuário final fala com o Copilot.
- **Porta (Externa):** `5173`

### 2.5 API TOTVS Protheus (AdvPL)
- **Caminho:** `/advpl`
- **Função:** Contém os fontes (`.prw`) que criam a API REST nativa dentro do AppServer do Protheus. 
- **Destaques:** API `/QueryRest` customizada sem limite de paginação (`ROWNUM` do Oracle).

---

## 3. Infraestrutura, Banco de Dados e Serviços Cloud

Toda a orquestração acontece pelo `docker-compose.yml` na raiz:

- **Banco de Dados (PostgreSQL + PGVector):** 
  - Usado para memória vetorial (RAG) e tabelas relacionais de configuração do sistema.
  - Roda nativamente pelo docker-compose na porta `5435` do Host (mapeada para `5432` no container).
  - Inclui o `Adminer` rodando na porta `8080` para manutenção do banco por interface visual.
- **Motor de Inteligência Artificial:** 
  - Pode rodar remotamente (API Gemini) ou Localmente (Ollama rodando no Host na porta `11434`).
- **CDN e Storage:**
  - Uso do **Cloudflare R2** para armazenamento de arquivos e documentos (PDFs, Bases de conhecimento) usados pelo RAG.
  - Gerenciamento de cache via API do Cloudflare.
- **Cloudflare Tunnel:** 
  - Configurado via container `cloudflared` (`docker-compose.yml` linha 94) para expor as portas seguramente para a web externa.

---

## 4. Variáveis de Ambiente Críticas (.env)

O sistema exige o preenchimento de certas variáveis para funcionar. As chaves abaixo representam o **estado da configuração**, que podem ser preenchidas pelos painéis de Config.

### Backend (`/backend/.env`)
```ini
LLM_BACKEND=gemini # ou ollama
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=xxx
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3

R2_ENDPOINT_URL=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=copilot-knowledge

DATABASE_URL=postgresql://postgres:sap_password_123@127.0.0.1:5435/copilot_protheus
DB_DRIVER=oracle
JWT_SECRET=xxx

ADMIN_USER=admin
ADMIN_PASSWORD=admin123
```

### Protheus Control (`/admin-frontend/.env`)
```ini
VITE_ADMIN_USER=admin
VITE_ADMIN_PASSWORD=admin123
```

---

## 5. Passos para Migração / Restauração do Zero

Caso seja necessário pegar esses códigos e rodá-los em um **novo servidor Linux/Windows** limpo:

1. Instalar **Docker** e **Docker Compose**.
2. Clonar o repositório completo.
3. Criar e preencher o `backend/.env` e `admin-frontend/.env` baseando-se no backup das senhas e chaves Cloudflare/R2 e Hetzner.
4. Executar o build limpo dos containers:
   ```bash
   docker-compose build --no-cache
   ```
5. Levantar a infraestrutura:
   ```bash
   docker-compose up -d
   ```
6. Se optar por processamento de IA local (On-Premise):
   - Instalar o **Ollama** no host.
   - Puxar o modelo escolhido: `ollama run llama3`.
7. Compilar o script `.prw` contido na pasta `/advpl` no TOTVS Protheus do cliente.
8. Acessar `http://[IP-DO-SERVIDOR]:5174` (Painel Control) e validar as luzes de status em `Infraestrutura`.

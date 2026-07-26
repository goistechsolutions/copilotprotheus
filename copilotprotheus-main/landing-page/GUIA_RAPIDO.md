# Guia Rápido do Usuário — Copilot Protheus ✦

Bem-vindo ao Copilot Protheus! Este guia ajudará você a entender como utilizar o assistente de Inteligência Artificial integrado ao seu ERP TOTVS Protheus de forma rápida e eficiente.

---

## 🚀 Como Iniciar

O Copilot Protheus pode ser executado em três modos principais:
1. **Auto-hospedado (Local):** Rodando via Docker Compose e Ollama local.
2. **Híbrido (Desenvolvimento/Nuvem):** Banco no Supabase, RAG no Cloudflare R2 e LLM local/nuvem.
3. **Produção (SaaS):** Acessível via subdomínio exposto de forma segura pelo túnel da Cloudflare.

---

## 🌐 Extensão de Navegador (Microsoft Edge / Chrome)

A extensão é a ponte que injeta o widget de chat diretamente no painel do seu Protheus WebApp.

### Como instalar no modo Desenvolvedor:
1. Abra o Microsoft Edge (ou Google Chrome) e acesse: `edge://extensions` (ou `chrome://extensions`).
2. Ative o modo **"Modo do desenvolvedor"** no canto inferior esquerdo (ou superior direito).
3. Clique em **"Carregar sem pacote"** (Load unpacked).
4. Selecione a pasta [edge_extension](file:///C:/projeto/copilotprotheus/edge_extension) do projeto.
5. Pronto! A extensão estará ativa.

### Configurando as conexões na Extensão:
Ao clicar no ícone da extensão na barra de ferramentas, você verá o painel de configurações:
* **URL do Widget (Vite/Nuvem):** Onde o frontend do chat está rodando (padrão local: `http://localhost:5173/` ou nuvem: `https://copilot.elitecorp.tec.br`).
* **URL de Lançamento (FastAPI):** Rota do backend API (padrão local: `http://127.0.0.1:8000/api/launch`).
* Clique em **Salvar** para aplicar as novas URLs imediatamente!

---

## ⌨️ Atalhos de Teclado no Protheus

Quando estiver navegando no ERP Protheus com a extensão ativa:
* **`Ctrl + Shift + P`**: Atalho universal para **Mostrar ou Ocultar** o widget flutuante de chat instantaneamente na tela do ERP.

---

## 💬 Recursos Premium da Interface

1. **Streaming SSE (Server-Sent Events):** As respostas da inteligência artificial começam a ser escritas na tela caractere por caractere instantaneamente.
2. **Markdown Completo:** Suporte a cabeçalhos (`##`), listas (`-`) e negritos (`**`).
3. **Blocos de Código Premium:** Respostas contendo scripts, queries SQL ou tabelas são renderizadas em blocos escuros estilizados contendo um botão de **"Copiar"** rápido.
4. **Modo Escuro / Dark Mode:** Clique no ícone de lua `🌙` no cabeçalho do widget para ativar a interface dark, ideal para longas jornadas de trabalho. O estado é salvo de forma persistente.
5. **Feedback Thumbs:** Avalie a resposta da IA clicando em 👍 ou 👎 nos balões de mensagens do chat.

---

## 🧠 Engenharia de Prompt e Contexto Dinâmico

O Copilot Protheus lê o contexto da tela atual (Screen Scraping) e os metadados ativos (Usuário, Empresa, Filial, Módulo do Protheus) de forma automatizada para responder com máxima precisão.

### Exemplos de perguntas que você pode fazer:
* *"Quem é a empresa padrão da conexão?"*
* *"Listar pedidos pendentes no faturamento"*
* *"Analisar o status do pedido #00341"* (o sistema extrairá os dados via API REST e fará a análise preditiva)
* *"Explicar a tabela SE1"* (o sistema lerá a base de conhecimento/RAG documentada no Cloudflare R2 e trará o tutorial)

---

🐳 Comandos de Inicialização Rápida

Caso queira subir o ambiente completo localmente de forma manual:
```bash
# Na pasta raiz
docker-compose up --build
```
Isso iniciará o **FastAPI Backend (Porta 8000)**, o **Express Middleware (Porta 3001)** e o **Vite Frontend (Porta 5173)** de forma totalmente integrada e orquestrada.

---

## ⚙️ Inicialização Automática (Windows Background Service)

Para que toda a pilha do Copilot Protheus e o Túnel Cloudflare iniciem automaticamente de forma silenciosa em segundo plano sempre que o Windows inicializar:

### 1. Registrar o Serviço:
Abra um console do **PowerShell como Administrador** e execute:
```powershell
# Registrar no Agendador de Tarefas do Windows
.\scripts\startup_agent.ps1 -Register
```
*(Por padrão, ele utilizará o modo Docker. Se quiser rodar a stack nativa sem contêineres, adicione `-Mode native` no comando).*

### 2. Desregistrar/Remover o Serviço:
Caso queira desativar a inicialização automática futura, abra o PowerShell como Administrador e execute:
```powershell
.\scripts\startup_agent.ps1 -Unregister
```


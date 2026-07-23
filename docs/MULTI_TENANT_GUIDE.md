# Guia de Operação Multi-Tenant - Copilot Protheus

Este documento detalha o modelo de isolamento de clientes (Tenants) implementado no projeto, garantindo segurança total entre diferentes empresas utilizando a mesma infraestrutura de Inteligência Artificial e Backend.

## 1. Visão Geral da Arquitetura

O sistema é construído como um **SaaS Single-Instance Multi-Tenant**. 
Isso significa que existe apenas uma frota de containers rodando (1 backend, 1 middleware, 1 frontend), mas o software virtualiza lógicamente os dados para que o Cliente A jamais enxergue os dados ou se conecte ao ERP do Cliente B.

O identificador universal usado em toda a malha é o **`tenant_id`**.

## 2. Isolamento de Conexão com ERP (Protheus)

Cada tenant possui seu próprio `TenantConnector` salvo no banco de dados.
- O Middleware recebe a intenção de IA e dispara o comando ao Backend.
- O Backend recupera o `tenant_id` via JWT da sessão.
- O serviço `protheus_service.py` busca dinamicamente a URL, Usuário e Senha daquele `tenant_id` no banco de dados.
- Caso o tenant A pergunte "Qual meu faturamento?", a API do Protheus da empresa A será consultada.

## 3. Isolamento RAG (Retrieval-Augmented Generation)

A base de conhecimento em vetor (Pgvector) suporta documentos **compartilhados** e **exclusivos**:
- **Shared (`visibility = 'shared'`)**: Manuais genéricos da TOTVS, legislações federais e instruções do Copilot. Úteis para todos os clientes, economizando espaço em disco e embeddings.
- **Tenant (`visibility = 'tenant'`)**: Regras de negócio, manuais de processos internos e dados confidenciais de uma empresa específica.
  
Na busca (`rag_service.py`), a query SQL obrigatoriamente aplica a cláusula:
`WHERE (d.visibility = 'shared' OR (d.visibility = 'tenant' AND d.tenant_id = :tenant_id))`

## 4. Isolamento em Nuvem (Cloudflare R2 / AWS S3)

Quando um PDF é feito o upload para alimentar a IA, ele é armazenado fisicamente isolado no bucket, utilizando o esquema de pastas (Prefixes):
- `r2://copilot-bucket/shared/manual_totvs.pdf`
- `r2://copilot-bucket/tenants/elitecorp/processo_compras.pdf`

## 5. Provisionamento Rápido

Para integrar uma nova empresa cliente:
1. Cadastre-a no banco de dados nas tabelas `tenants`, `tenant_connectors` e `agent_users`.
2. Para agilizar, você pode usar o script de automação localizado em `scripts/provision_tenant.sh <ID> <NOME> <URL>`.
3. O cliente receberá um usuário `admin@<tenant_id>` com poderes restritos apenas à própria organização.

## 6. Papéis e Permissões (RBAC)

O token JWT agora transporta a *claim* `role`:
- **`system` / `superadmin`**: Visão global da infraestrutura (Hetzner, IPs, Docker).
- **`admin` (de Tenant)**: Pode adicionar novos usuários dentro de sua própria empresa e fazer upload de PDFs restritos.
- **`user`**: Apenas conversa com a IA e executa queries SQL, sem visão administrativa.

> **Importante:** No modo estrito (`TENANT_HEADER_REQUIRED=true`), qualquer requisição ao Middleware sem um `x-tenant-id` ou com um token inválido será barrada sumariamente (401/403).

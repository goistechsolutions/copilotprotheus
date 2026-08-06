# Handoff Document — Copilot Protheus (V4 Multi-Tenant)

> **Data de Geração**: 04 de Agosto de 2026  
> **Versão da Arquitetura**: Multi-Tenant V4 — Schema per Tenant  
> **Repositório**: [github.com/goistechsolutions/copilotprotheus](https://github.com/goistechsolutions/copilotprotheus) (privado)  
> **Propósito deste documento**: Permitir que qualquer IA ou desenvolvedor retome o projeto com contexto completo, sem perda de histórico de decisões.

---

## 1. O que é este projeto

O **Copilot Protheus** é um assistente de inteligência artificial corporativo integrado ao ERP TOTVS Protheus. Gestores e analistas realizam consultas complexas, consolidações financeiras, operacionais e geração de relatórios via linguagem natural — sem precisar saber SQL ou navegar no ERP.

### Três pilares fundamentais (NÃO alterar sem decisão consciente)

1. **Consultas SQL Nativas no Oracle via `/QueryRest`** — Toda consulta de dados é enviada diretamente ao banco Oracle do Protheus via HTTP POST. Jamais gerar dados fictícios (zero tolerância a alucinação de dados).
2. **Fidelidade de Dados com Fallback Seguro** — Se o AppServer Protheus estiver offline, o sistema usa o dicionário local em PostgreSQL como fallback ou informa o status real ao usuário.
3. **Isolamento Multi-Tenant por Schema PostgreSQL** — Cada empresa (tenant) tem seu próprio schema isolado no PostgreSQL (ex: schema `rodol`). Schemas com nomes numéricos são proibidos.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Observações |
|--------|-----------|-------------|
| **Backend** | Python / FastAPI | `app/` e `backend/` no repositório |
| **Banco de Dados** | PostgreSQL (Multi-Tenant) + Oracle (Protheus) | Ver seção 4 |
| **Frontend Copilot** | React + Vite | Diretório `copilot-frontend/` |
| **Admin Panel** | React + Vite | Diretório `admin-frontend/` |
| **Infraestrutura** | Hetzner VPS (Ubuntu) | Backend principal |
| **Proxy / Túnel** | Cloudflare Tunnel (cloudflared) | Exposição segura sem IP público |
| **Containerização** | Docker + docker-compose | `docker-compose.yml` na raiz |
| **Migrações DB** | Alembic | `alembic.ini` na raiz |
| **ADVPL** | Customizações Protheus | Diretório `advpl/` |
| **Edge Extension** | Microsoft Edge | Diretório `edge_extension/` |
| **Landing Page** | HTML/CSS/JS | Diretório `landing-page/` |

---

## 3. Estrutura do Repositório

```
copilotprotheus/
├── .agents/                  # Configurações de agentes de IA
├── .github/                  # CI/CD workflows
├── admin-frontend/           # Painel administrativo (React/Vite)
├── advpl/                    # Customizações TOTVS em ADVPL
├── app/                      # Módulo principal FastAPI (app Python)
├── backend/                  # Backend auxiliar
├── config/                   # Arquivos de configuração
├── copilot-frontend/         # Interface do usuário Copilot (React/Vite)
├── copilotprotheus-main/     # Core legacy / versão anterior
├── database/                 # Scripts DDL e migrations SQL
├── db/                       # Utilitários de banco
├── docs/                     # Documentação interna
├── edge_extension/           # Extensão para Microsoft Edge
├── environments/             # Configs por ambiente (dev/prod)
├── etc/                      # Configurações de sistema (nginx, systemd)
├── frontend/                 # Frontend genérico / legacy
├── landing-page/             # Página de marketing
├── middleware/                # Middlewares FastAPI
├── scripts/                  # Scripts de instalação e manutenção
├── skill/                    # Módulo de habilidades do agente
├── tools/                    # Ferramentas auxiliares
├── .env.example              # Template de variáveis de ambiente
├── pilot.env.example         # Template env alternativo
├── Dockerfile                # Build da imagem Docker
├── docker-compose.yml        # Orquestração de containers
├── alembic.ini               # Configuração de migrações
├── PROJECT_MEMORY.md         # Memória de decisões técnicas (LEITURA OBRIGATÓRIA)
├── deploy_copilot_protheus.ps1  # Script deploy Windows
├── DEPLOY_AZURE_GPU.md       # Guia deploy Azure GPU
├── SECURITY.md               # Políticas de segurança
└── tenant.yaml               # Configuração de tenant exemplo
```

> **IMPORTANTE**: Ler `PROJECT_MEMORY.md` é obrigatório antes de qualquer alteração. Ele contém o histórico de decisões técnicas que não devem ser revertidas.

---

## 4. Arquitetura de Banco de Dados (PostgreSQL Multi-Tenant V4)

### 4.1 Divisão de Schemas

A arquitetura é dividida em duas zonas:

- **Schema `public`** — Governança global da plataforma (tenants, planos, admins, auditoria)
- **Schema por tenant** — Dados exclusivos de cada empresa (ex: `rodol`, `empresa2`)

### 4.2 Tabelas do Schema `public`

| Tabela | Descrição | Campos Críticos |
|--------|-----------|-----------------|
| `public.tenant_registry` | Cadastro central de empresas | `tenant_code` (ex: `"rodol"`), `schema_name`, `status` (`active` \| `provisioning`) |
| `public.protheus_modules_master` | Catálogo global de módulos Protheus | `module_code` (numérico: `01`, `05`), `module_name` (sigla: `SIGAFIN`), `description` |
| `public.plans` | Planos de assinatura | `plan_code`, `max_users`, `max_queries_day`, `modules_allowed` (JSONB) |
| `public.platform_admins` | Administradores da plataforma | `email`, `password_hash`, `is_superadmin` |
| `public.platform_audit_log` | Auditoria global | `tenant_code`, `actor`, `action`, `detail` (JSONB), `created_at` |

### 4.3 Tabelas por Tenant (ex: schema `"rodol"`)

| Tabela | Descrição | Campos Críticos |
|--------|-----------|-----------------|
| `"{tenant}".company_info` | Credenciais REST do Protheus | `company_code`, `branch_code`, `protheus_rest_url`, `encrypted_protheus_password` |
| `"{tenant}".protheus_modules` | Módulos ativos da empresa | `modulo` (código numérico), `codmod` (sigla), com índices em ambos |
| `"{tenant}".tenant_schemas` | Cache do dicionário Protheus (SX2/SX3) | `chave` (ex: `SE1`), `tabela` (ex: `SE1010`), `schema_json` (JSONB) |
| `"{tenant}".users` | Usuários do tenant | `email`, `full_name`, `password_hash`, `status` |

### 4.4 Regra de Vínculo Relacional (CRÍTICA)

```sql
-- SEMPRE usar código numérico para JOINs entre tabelas de módulos
protheus_modules.modulo = tenant_schemas.modulo
-- ex: '05' = '05'  (SIGAFIN)
-- NUNCA usar a sigla como chave de JOIN
```

### 4.5 Utilitário de Segurança de Schema

```python
# Sempre usar ao resolver o tenant_id antes de montar queries dinâmicas
resolve_clean_tenant(db, tenant_id)
# Schemas numéricos (ex: "1") são proibidos — o utilitário resolve automaticamente
```

---

## 5. Motor de Consultas SQL Nativas (Oracle via QueryRest)

### Fluxo

```
Usuário → Linguagem Natural → IA gera SQL Oracle → POST /QueryRest → AppServer Protheus → Oracle DB → Resposta
```

### Regras de Dialeto Oracle (OBRIGATÓRIAS)

```sql
-- ❌ PROIBIDO
SELECT TOP 10 * FROM SE1010

-- ✅ CORRETO para limite simples
SELECT * FROM SE1010 WHERE ROWNUM <= 10

-- ✅ CORRETO para paginação
SELECT * FROM SE1010
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
```

### Filtros Protheus Obrigatórios em TODA consulta

```sql
-- Exclusão de registros marcados como deletados (OBRIGATÓRIO em toda tabela)
WHERE D_E_L_E_T_ <> '*'

-- JOIN canônico: Notas de Saída
SF2 (Cabeçalho) JOIN SD2 (Itens) JOIN SF4 (TES)
ON SD2.D2_TES = SF4.F4_CODIGO

-- JOIN canônico: Notas de Entrada
SF1 (Cabeçalho) JOIN SD1 (Itens) JOIN SF4 (TES)
ON SD1.D1_TES = SF4.F4_CODIGO
```

---

## 6. Infraestrutura e Conectividade

### Topologia

```
[Cliente Browser]
       |
[Cloudflare CDN/WAF]
       |
[Cloudflare Tunnel (cloudflared)] ←── instalado na VPS Hetzner
       |
[VPS Hetzner Ubuntu]
       ├── FastAPI Backend (porta interna)
       ├── PostgreSQL (porta interna)
       ├── Docker containers
       └── Admin Panel / Copilot Frontend (build estático)
```

### Cloudflare Tunnel

O serviço `cloudflared` expõe o backend sem abrir portas no firewall da VPS.

```bash
# Serviço systemd
systemctl status cloudflared

# Reinstalar/configurar (usar o token salvo no .env)
# Ver scripts/install-cloudflared.sh no repositório
```

### Variáveis de Ambiente

Sempre partir do `.env.example` ou `pilot.env.example` na raiz do repositório. As variáveis críticas incluem:

- `DATABASE_URL` — Connection string PostgreSQL
- `CLOUDFLARE_TUNNEL_TOKEN` — Token do túnel Cloudflare
- `PROTHEUS_REST_URL` — URL base do AppServer Protheus
- `SECRET_KEY` — Chave JWT da API
- `ENCRYPTION_KEY` — Chave de criptografia de senhas do Protheus

---

## 7. Módulos Funcionais Implementados

| Módulo | Status | Descrição |
|--------|--------|-----------|
| Motor QueryRest | ✅ Implementado | Tradução NL → SQL Oracle |
| Multi-Tenant V4 | ✅ Implementado | Schema por tenant com `resolve_clean_tenant` |
| Admin Panel | ✅ Implementado | Gestão de tenants, usuários, planos |
| Copilot Frontend | ✅ Implementado | Interface de chat do usuário final |
| Sincronização SX2/SX3 | ✅ Implementado | Cache do dicionário Protheus em PostgreSQL |
| Edge Extension | 🔄 Em desenvolvimento | Extensão Microsoft Edge |
| Landing Page | ✅ Implementado | Página de marketing |
| ADVPL QueryRest | ✅ Implementado | Endpoint genérico no Protheus |

---

## 8. Padrões de Desenvolvimento

### Nomenclatura de Schemas

```python
# Schema público: sempre "public"
# Schema de tenant: código limpo (nunca numérico)
# Exemplos válidos: "rodol", "empresa_abc"
# Exemplos inválidos: "1", "01", "123"
```

### Criação de Tenant (fluxo obrigatório)

1. Inserir em `public.tenant_registry` com `status = 'provisioning'`
2. Executar DDL para criar schema dedicado
3. Criar tabelas `company_info`, `protheus_modules`, `tenant_schemas`, `users`
4. Criar índices conforme padrão `idx_{tenant}_{table}_{column}`
5. Atualizar `status = 'active'`

### Sincronização do Dicionário Protheus

- Origem: `SYS_USR_MODULE` (módulos) e tabelas SX2/SX3 (dicionário)
- Destino: `"{tenant}".protheus_modules` e `"{tenant}".tenant_schemas`
- Disparador: manual via endpoint `/admin/sync/{tenant}` ou scheduled job

---

## 9. Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| 404 ao baixar scripts via `curl` do GitHub | Repositório privado sem autenticação | Usar `-H "Authorization: token SEU_TOKEN"` no curl |
| Schema numérico causa erro | Tenant cadastrado com código numérico | Usar `resolve_clean_tenant(db, tenant_id)` antes de queries |
| `SELECT TOP N` falha no Oracle | Dialeto SQL Server incorreto | Usar `ROWNUM <= N` ou `FETCH NEXT N ROWS ONLY` |
| Cloudflared não inicia após reboot | Token expirado ou serviço não configurado | Reinstalar via `scripts/install-cloudflared.sh` |
| Dados fictícios na resposta | IA alucinando quando QueryRest offline | Implementar verificação de disponibilidade antes de gerar SQL |

---

## 10. Próximos Passos Pendentes (Backlog Técnico)

1. **Finalizar Edge Extension** — integração com Protheus via browser extension no Microsoft Edge
2. **Implementar Rate Limiting por Tenant** — usar `max_queries_day` da tabela `public.plans`
3. **Webhook de Sincronização** — trigger automático de SX2/SX3 quando schema do Protheus mudar
4. **Dashboard de Monitoramento** — métricas de queries por tenant, tempo de resposta, erros
5. **Testes de Integração Oracle** — cobertura de testes para o motor QueryRest
6. **Documentação de ADVPL** — spec funcional dos endpoints criados no AppServer

---

## 11. Como Continuar com Outra IA

### Prompt de contexto inicial recomendado

```
Você vai continuar o desenvolvimento do projeto Copilot Protheus.
Leia o arquivo HANDOFF_COPILOT_PROTHEUS.md e o PROJECT_MEMORY.md do repositório
github.com/goistechsolutions/copilotprotheus antes de qualquer ação.

Regras invioláveis:
1. Nunca gerar dados fictícios/alucinados — sempre buscar do Oracle via QueryRest
2. Nunca usar SELECT TOP N — usar ROWNUM ou FETCH NEXT
3. Sempre filtrar D_E_L_E_T_ <> '*' em toda query Protheus
4. Sempre usar resolve_clean_tenant() antes de queries dinâmicas por tenant
5. Schemas de tenant nunca podem ser numéricos
```

### Comandos essenciais para verificar o ambiente

```bash
# Verificar status dos serviços
systemctl status cloudflared
systemctl status copilotprotheus-backend  # ou nome do serviço configurado

# Verificar containers
docker ps
docker-compose ps

# Verificar conexão PostgreSQL
psql $DATABASE_URL -c "SELECT tenant_code, status FROM public.tenant_registry;"

# Verificar logs do backend
journalctl -u copilotprotheus-backend -n 100 --no-pager
docker-compose logs backend --tail=100
```

---

## 12. Recursos e Referências

| Recurso | URL |
|---------|-----|
| Repositório GitHub | [github.com/goistechsolutions/copilotprotheus](https://github.com/goistechsolutions/copilotprotheus) |
| Documentação TOTVS REST | [tdn.totvs.com/display/tec/REST](https://tdn.totvs.com/display/tec/REST) |
| Documentação Framework Protheus | [tdn.totvs.com/display/public/framework](https://tdn.totvs.com/display/public/framework/Framework+%7C+Base+de+Conhecimento) |
| Cloudflare Tunnel Docs | [developers.cloudflare.com/cloudflare-one/connections/connect-apps](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps) |
| Alembic Migrations | [alembic.sqlalchemy.org](https://alembic.sqlalchemy.org) |
| FastAPI Docs | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |

---

*Documento gerado automaticamente em 04/08/2026 com base no repositório e histórico de sessões do projeto.*

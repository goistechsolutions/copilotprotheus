# Análise de Aderência — Copilot Protheus

> **Metodologia**: Cada item do escopo foi verificado contra o código-fonte real do projeto.  
> Legenda: ✅ Implementado | ⚠️ Parcialmente implementado | ❌ Ausente / Não implementado

---

## 1. Visão Geral

| Requisito | Status | Evidência |
|---|---|---|
| Assistente inteligente integrado ao Protheus | ✅ | Widget React + Middleware Node + Backend FastAPI |
| Modo exclusivo de leitura | ⚠️ | ADVPL usa só GET/SELECT, mas o backend não tem validação explícita de readonly |
| Foco: Faturamento, Financeiro, Estoque, Compras | ✅ | `intentClassifier.js`, `sql_service.py`, `advpl_apis.prw` |

---

## 2. Arquitetura Enterprise

| Requisito | Status | Evidência |
|---|---|---|
| Frontend (Widget) → Middleware Node → APIs REST → IA | ✅ | `AssistantWidget.jsx` → `chat.js` → `backendClient.js` → `ollama_client.py` |
| Motor de IA em serviço dedicado (FastAPI) | ✅ | Backend FastAPI em `backend/` com Ollama/OVMS |
| Padrão orientado a serviços | ✅ | Separação clara em camadas: frontend / middleware / backend |
| Preparado para alta concorrência | ⚠️ | Rate limit presente, mas sem paralelismo explícito de queries (ex: `Promise.all`) |

---

## 3. Segurança

| Requisito | Status | Evidência |
|---|---|---|
| APIs somente leitura (SELECT) | ⚠️ | ADVPL usa apenas GET, mas sem camada de guarda que proíba POST/PUT/DELETE |
| Usuário técnico restrito | ✅ | `PROTHEUS_USER` / `PROTHEUS_PASSWORD` via `.env` |
| Autenticação JWT | ❌ | **Ausente** — middleware usa apenas Basic Auth no Protheus, sem JWT no próprio middleware |
| Rate limit configurado | ✅ | `express-rate-limit` configurado: 60 req/min em `server.js` |
| Logs completos de auditoria | ⚠️ | Logs de middleware via Winston/console; tabela `audit_logs` no schema SQL, mas `AuditService` salva em SQLite local (não PostgreSQL) |

---

## 4. Captura de Contexto

| Requisito | Status | Evidência |
|---|---|---|
| Contexto do Protheus enriquece a análise | ✅ | `contextNormalizer.js` normaliza módulo, empresa, filial, usuário, pedido |
| Parâmetros: módulo, pedido, usuário, empresa, filial, ambiente | ✅ | Todos presentes em `contextNormalizer.js` e `context.py` |
| Contexto enviado junto com cada pergunta | ✅ | `chat.js` inclui `ctx` completo no payload ao backend |

---

## 5. Classificação de Intenção

| Requisito | Status | Evidência |
|---|---|---|
| Estratégia híbrida: regras + IA | ⚠️ | Heurística implementada em `intentClassifier.js`; o "fallback para IA" retorna `ai_fallback` como flag, mas **não aciona nenhuma chamada LLM real** para classificação |
| Tipos: faturamento, financeiro, estoque, compras, geral | ✅ | Todos presentes em `INTENTS[]` no `intentClassifier.js` |
| Classificação inicial via heurística | ✅ | Keywords + módulo com score de confiança |

---

## 6. Middleware

| Requisito | Status | Evidência |
|---|---|---|
| Orquestra chamadas e aplica lógica de negócio | ✅ | `chat.js` → classify → enrich → backend |
| Cache | ❌ | **Ausente** — nenhuma implementação de cache (ex: node-cache, Redis) |
| Paralelismo | ❌ | **Ausente** — `protheusEnricher.js` executa sequencialmente, sem `Promise.all` |
| Tratamento de erros | ✅ | Try/catch com fallback em `chat.js` e `server.js` |
| Timeout padrão de 15 segundos | ✅ | `protheusClient.js`: `timeout: 15000` |
| Limite de 100 registros por requisição | ⚠️ | `sql_service.py` usa `TOP 100`, mas não há validação de limite no middleware |

---

## 7. APIs Protheus (ADVPL)

| Requisito | Status | Evidência |
|---|---|---|
| Serviços REST em ADVPL | ✅ | `docs/advpl_apis.prw` com 4 endpoints (Pedido, Títulos, Saldo, Compras) |
| Paginação | ❌ | **Ausente** — nenhum dos endpoints ADVPL implementa paginação |
| ORDER BY | ✅ | Presente nas queries de SE1 e SC7 |
| Uso de índices | ✅ | `DbSetOrder(1)` em SC5 e SB2; TCGenQry nas demais |
| Tabelas: SC5, SC6, SE1, SB2, SC7 | ⚠️ | SC5, SE1, SB2, SC7 presentes; **SC6 ausente** |
| Nunca usar SELECT * | ⚠️ | ADVPL ok (campos explícitos), mas `sql_service.py` usa **`SELECT TOP 100 *`** — violação direta da regra |
| Filtro D_E_L_E_T_ | ✅ | Presente em todas as queries SQL do ADVPL |
| Filtro por filial | ✅ | `xFilial()` usado em todos os endpoints ADVPL |

---

## 8. Motor de Análise (IA)

| Requisito | Status | Evidência |
|---|---|---|
| Transforma dados em insights | ✅ | `ollama_client.py` constrói prompt contextualizado com dados do Protheus |
| Identifica causas de problemas | ⚠️ | Dependente do LLM (Ollama/OVMS); sem lógica determinística de diagnóstico |
| Retorna explicações claras | ✅ | System prompt instrui respostas objetivas em português |
| Suporte a múltiplos backends LLM | ✅ | Ollama e OVMS configuráveis via `LLM_BACKEND` |

---

## 9. Auditoria (ZIA)

| Requisito | Status | Evidência |
|---|---|---|
| Registro de todas interações | ⚠️ | `AuditService` existe, mas só cria tabela em SQLite; **não integrado ao fluxo** em `assistant_service.py` |
| Campo: intenção | ❌ | Ausente na tabela `assistant_audit` |
| Campo: tempo de resposta | ❌ | Ausente na tabela `assistant_audit` |
| Campo: volume retornado | ❌ | Ausente na tabela `assistant_audit` |
| Tabela `audit_logs` no schema PostgreSQL | ✅ | Presente em `schema_knowledge_base.sql` |

> [!CAUTION]
> O `AuditService` **não é chamado** em nenhum ponto do fluxo de resposta (`assistant_service.py` não instancia nem chama `AuditService`). A auditoria está estruturada mas **inativa**.

---

## 10. Performance

| Requisito | Status | Evidência |
|---|---|---|
| Cache de curto prazo (30–60 segundos) | ❌ | **Completamente ausente** — nenhum mecanismo de cache implementado |
| Execução paralela de consultas | ❌ | **Ausente** — enrich sequencial |
| Evitar joins complexos | ✅ | ADVPL usa queries simples; RAGService faz join básico |
| Evitar grandes volumes | ✅ | `TOP 100` em SQL, `limit: 4` no RAG |

---

## 11. Fluxo Operacional

| Requisito | Status | Evidência |
|---|---|---|
| Usuário → Chat → Middleware → Protheus → IA → Resposta | ✅ | Fluxo completo implementado e funcional |
| Rápido | ⚠️ | Timeout configurado, mas sem cache nem paralelismo |
| Resiliente | ⚠️ | Tratamento de erros existe, mas sem retry ou circuit breaker |
| Auditável | ⚠️ | Logs existem, mas auditoria transacional inativa |

---

## 12. Governança

| Requisito | Status | Evidência |
|---|---|---|
| Monitoramento de uso | ⚠️ | Logs de Morgan/console, sem dashboard ou métricas agregadas |
| Identificação de gargalos | ❌ | Sem APM, tracing ou profiling implementado |
| Base para melhoria contínua | ⚠️ | Schema de auditoria preparado, mas dados não coletados ativamente |

---

## 13. Boas Práticas

| Requisito | Status | Evidência |
|---|---|---|
| Sempre filtrar por filial | ✅ | `xFilial()` em todos os endpoints ADVPL |
| Filtrar por D_E_L_E_T_ | ✅ | Presente em todas as queries ADVPL |
| Usar índices SIX | ✅ | `DbSetOrder(1)` e índices nas queries |
| Controle de tempo de resposta | ✅ | Timeout: 15s (Protheus), 30s (backend) |
| Respostas objetivas e baseadas em dados reais | ✅ | System prompt instrui: "Nunca invente dados" |
| **PROIBIDO: SELECT *** | ❌ | `sql_service.py` usa `SELECT TOP 100 *` em todas as queries |

---

## 14. Roadmap Evolutivo

| Fase | Status | Observação |
|---|---|---|
| Fase 1 — Consultas básicas | ✅ | Implementada e funcional |
| Fase 2 — Análises cruzadas | ❌ | Não implementada |
| Fase 3 — Insights preditivos | ❌ | Não implementada |
| Fase 4 — IA preventiva (alertas antes de erro) | ❌ | Não implementada |

---

## Resumo Executivo

| Categoria | ✅ | ⚠️ | ❌ |
|---|---|---|---|
| Implementado completamente | 24 itens | — | — |
| Parcialmente implementado | — | 17 itens | — |
| Ausente / Não implementado | — | — | 11 itens |

### Pontos Críticos que Exigem Ação Imediata

1. **JWT ausente** — o middleware não autentica requisições recebidas do frontend
2. **Auditoria inativa** — `AuditService` nunca é chamado no fluxo principal
3. **`SELECT *` em `sql_service.py`** — viola diretamente uma regra de governança do escopo
4. **Cache ausente** — sem cache, cada pergunta gera consultas desnecessárias ao LLM e Protheus
5. **Paginação ADVPL ausente** — endpoints não suportam paginação, risco de sobrecarga
6. **SC6 não implementada** — tabela de itens de pedido ausente nos endpoints ADVPL
7. **Paralelismo ausente** — enrich e queries executam em série

### Estimativa de Aderência Global

**≈ 62% de aderência ao escopo definido** (considerando peso dos itens críticos)

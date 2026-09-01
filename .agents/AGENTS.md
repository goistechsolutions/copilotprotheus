# Agent Context — Copilot Protheus (Cloud Architecture)

Você é o copiloto de engenharia de software da plataforma Copilot Protheus. 
Este projeto é estritamente baseado em arquitetura em nuvem (Hetzner + Cloudflare + TOTVS Protheus REST).

## 1. Topologia e Ambientes de Nuvem
- **Frontend do Chat:** React/Vite hospedado no Cloudflare Pages (`https://copilot.elitecorp.tec.br`).
- **Painel Administrativo:** React/Vite + Nginx servido via Cloudflare Tunnel em `https://copilot-api.elitecorp.tec.br/admin` (porta interna 5174).
- **Backend API:** FastAPI/Uvicorn em contêiner Docker na VPS Hetzner em `https://copilot-api.elitecorp.tec.br/api` (porta interna 8000).
- **Middleware Proxy:** Node.js/Express na rede interna Docker (porta 3001).
- **Banco de Governança e Vetores:** PostgreSQL 16 com `pgvector` em contêiner Docker (porta interna 5432, mapeada internamente para 5435 na VPS).
- **Storage de Conhecimento (RAG):** Cloudflare R2.
- **Túnel de Rede:** Contêiner `copilot-protheus-cloudflared` (zero portas de aplicação abertas no firewall público da VPS).
- **Raiz Operacional de Deploy na VPS:** `/root/copilotprotheus`.

## 2. Princípios Obrigatórios de Desenvolvimento
1. **Zero Alucinação de Dados:** Nunca simular, estimar ou preencher valores de ERP. Se o Protheus não responder, a permissão for negada ou o retorno for vazio, relate a indisponibilidade ou bloqueio com clareza.
2. **Isolamento Multi-Tenant Estrito:** Todas as operações exigem `tenant_code` + `environment_code` explícitos. Proibido fallback para "default" ou "None".
3. **Autenticação OAuth2 / Bearer:** Chamadas operacionais ao `QueryRest` devem conter o header `Authorization: Bearer <access_token>`. Proibido Basic Auth em consultas operacionais.
4. **Catálogo Global Desacoplado:** `public.protheus_modules_master` é global e indexado por `mod_code = USR_MODULO` (sigla `USR_CODMOD` para UI). Não contém URLs, usuários, senhas ou tokens.
5. **Conexões por Tenant/Ambiente:** Centralizadas em `public.protheus_rest_connections` sob a chave única `(tenant_code, environment_code)`.
6. **SQL Oracle e Protheus:**
   - Todo SELECT em tabelas Protheus deve conter `D_E_L_E_T_ <> '*'`.
   - Limites com `ROWNUM <= n` ou `FETCH FIRST n ROWS ONLY` (nunca `TOP` ou `LIMIT`).
   - Datas em formato `VARCHAR2(8)` (`YYYYMMDD`).
7. **Segurança de Segredos:** Tokens, senhas e headers Authorization nunca devem ser logados, retornados em payloads de API ou exibidos no frontend.

## 3. Padrões de Contratos de API
- O payload de atualização de tenant deve isolar a conexão REST em um bloco aninhado `connection: ProtheusConnectionUpdate` com `extra='forbid'`.
- A senha administrativa do painel Copilot nunca deve ser enviada no mesmo contexto ou usada como senha REST do Protheus.
- Erros de integração externa devem preservar status HTTP semânticos (400, 401, 403, 502, 504), nunca mascarando falhas externas como 500 genérico.
# Pacote P0 — Autenticaçª£o, Autorizaçª£o e Contexto Seguro

## Objetivo

Eliminar o acesso anï¿½nimo às rotas do agente e impedir que dados enviados pelo browser (query string, DOM Scraping ou postMessage) sejam usados como prova de identidade ou como fonte de verdade para o tenant.

## Infraestrutura e Pipeline

- GitHub Actions: CI, testes, build e deploy com migraçªµes SQL.
- Hetzner: ïï¿½nico ambiente remoto de desenvolvimento.
- Cloudflare Tunnels: DNS, TLS, WAF e tï¿½nel reverso criptografado.
- PostgreSQL: scripts de migraçª£o aplicados pela pipeline.

## Escopo

- JWT obrigatï¿½rio em criaçª£o de tarefa, status, resultado, histï¿½rico e exportaï¿½ï¿½o do agente.
- Tenant, usuï¿½rio e role derivados exclusivamente das claims validadas.
- EntitlementGuard em enforce no ambiente remoto.
- GET /api/auth/me autenticado para o frontend.
- AuthGate no React antes de AgentWorkspace e ExecutiveDashboard.
- Validaçª£o de origin, source, type e payload no postMessage.
- Substituiï¿½ï¿½o de targetOrigin * por origem pai validada.
- Bypass local apenas via .env.local, nunca em build remoto.

## Modelo de confiança

| Dado | Fonte de verdade | Uso permitido |
|---|---|---|
| tenant_id | Claim JWT validada | Schema, auditoria e autorizaï¿½ï¿½o |
| user_id | Claim JWT validada | Auditoria e RBAC |
| role | JWT/resoluï¿½ï¿½o server-side | Entitlement |
| empresa, filial, ambiente, mï¿½dulo | Extensï¿½o/URL em desenvolvimento | Contexto operacional apï¿½s autorizaï¿½ï¿½o |
| token QueryRest | Backend | Integraï¿½ï¿½o Protheus; nunca navegador |

DOM Scraping da extensï¿½o pode preencher campos visuais, mas nï¿½o autentica usuï¿½ï¿½rio. event.origin confiï¿½vel confirma o canal, nï¿½o a identidade.

## Estados de interface

| Estado | Condiï¿½ï¿½o | Comportamento |
|---|---|---|
| unknown | auth/me ainda nï¿½o respondeu | Tela de carregamento, sem chat |
| unauthenticated | sem JWT, JWT invï¿½lido ou expirado | Bloqueio completo e orientaï¿½ï¿½o de login |
| authenticated sem contexto | JWT vï¿½lido, sem empresa/filial/ambiente | Aguarda contexto operacional; nï¿½o executa QueryRest |
| authenticated sem mï¿½dulo | JWT e contexto base vï¿½lidos, module vazio | Orientaï¿½ï¿½o geral permitida; consulta contextual depende da intenï¿½ï¿½o/politica |
| authenticated completo | JWT e contexto vï¿½lidos | Consulta somente apï¿½s entitlement |

## Backend

1. Substituir dependï¿½ncias opcionais nas rotas do agente por require_current_user; ausï¿½ncia de JWT deve retornar HTTP 401, nunca current_user=None.
2. Extrair tenant_id, user_id e role exclusivamente da sessï¿½o validada.
3. Caso o payload mantenha tenant_id por compatibilidade, comparar com a claim e retornar 403 se divergir.
4. Validar empresa, filial, ambiente e mï¿½dulo contra o usuï¿½ï¿½rio/role antes de montar SQL, consultar dicionï¿½ï¿½rio, chamar QueryRest ou retornar resultado.
5. Em APP_ENV=production, abortar startup se ENTITLEMENT_MODE for diferente de enforce.
6. Implementar/confirmar GET /api/auth/me, retornando authenticated, user_id, tenant_id e role.
7. Retornar mensagens sanitizadas com correlation_id; nï¿½o expor SQL, token, header Authorization, senha ou stack trace.

## Frontend

1. Criar AuthGate que chama GET /api/auth/me com credenciais.
2. Sem sessï¿½o, nï¿½o renderizar prompt, sugestï¿½es, histï¿½rico, dashboard ou resultado.
3. Aceitar postMessage somente se event.data for objeto, type for reconhecido, event.source for window.parent no iframe e event.origin pertencer aos domï¿½nios permitidos.
4. Produï¿½ï¿½o: HTTPS sob .protheus.cloudtotvs.com.br, .cloudtotvs.com.br ou .totvs.com.br; validar hostname por igualdade/sufixo com ponto, jamais includes().
5. Desenvolvimento local: localhost:5173 e 127.0.0.1:5173 somente com import.meta.env.DEV e VITE_ALLOW_LOCAL_POSTMESSAGE=true, restrito a .env.local.
6. Atualizaï¿½ï¿½o parcial preserva campos ausentes; module vazio ïï¿½ limpeza legï¿½tima. Mudanï¿½ï¿½a de tenant, ambiente, empresa, filial ou mï¿½dulo aborta tarefa e invalida resultado. Troca de tenant/ambiente cria nova conversa.
7. Apï¿½s primeira mensagem vï¿½lida, armazenar trustedParentOrigin. Mensagens ao pai usam essa origem; targetOrigin * ïï¿½ proibido.
8. Envolver InlineChatDashboard em ErrorBoundary para preservar a conversa em falha visual.

## Desenvolvimento local

VITE_DEV_BYPASS_AUTH sï¿½ ïï¿½ aceito visualmente quando APP_ENV=development e import.meta.env.DEV sï¿½o verdadeiros. O backend nunca aceita bypass em staging ou produï¿½ï¿½o e toda rota produtiva continua exigindo JWT.

## Auditoria PostgreSQL

Cada execuçª£o autorizada registra: correlation_id, tenant_id, user_id, role_id, empresa, filial, mï¿½dulo, decisï¿½o de entitlement, status, duraï¿½ï¿½o e cï¿½digo sanitizado de erro. Tokens e credenciais nunca sï¿½o persistidos em auditoria.

## Testes obrigatï¿½rios

- Sem JWT, JWT invï¿½lido e JWT expirado: 401.
- Tenant declarado diferente da claim: 403.
- Sem entitlement de tabela/campo/empresa/filial/mï¿½dulo: 403 antes do QueryRest.
- Produï¿½ï¿½o com entitlement shadow: startup bloqueado.
- auth/me sem sessï¿½o: AuthGate bloqueia toda a UI.
- postMessage externo: ignorado.
- Atualizaï¿½ï¿½o parcial de filial: contexto preservado, tarefa abortada e resultado limpo.
- Mï¿½dulo vazio com sessï¿½o vï¿½lida: nï¿½o equivale a logout.
- Iframe: nenhuma mensagem de retorno usa targetOrigin *.
- Usuï¿½ï¿½rio de tenant A nï¿½o lï¿½ tarefa, resultado ou histï¿½rico de tenant B.

## Ordem de aplicaï¿½ï¿½o

1. Implementar e testar JWT obrigatï¿½rio no backend.
2. Enforce de entitlement e derivaï¿½ï¿½o de tenant pela sessï¿½o.
3. Confirmar auth/me.
4. Implementar AuthGate.
5. Endurecer postMessage e ciclo de contexto.
6. Restaurar ErrorBoundary do dashboard inline.
7. Executar testes, lint, build e secret scanning.
8. Criar PR apï¿½s revisï¿½o de seguranï¿½a.

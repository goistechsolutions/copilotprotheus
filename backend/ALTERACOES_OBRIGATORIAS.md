# Backend — alterações obrigatórias

Os caminhos exatos dos routers/repositories não estavam disponíveis para leitura. Localize no repositório referências a:

```text
copilot_conversations
copilot_messages
copilot_dashboards
createConversation
getConversation
addConversationMessage
addConversationDashboard
```

## Implementar

1. `TenantContext` derivado exclusivamente da autenticação.
2. `TenantSchemaResolver` que consulta `public.tenants` e valida `schema_name`.
3. validação de tabelas/campos pela presença no snapshot ativo do tenant;
4. `TenantConversationRepository` com SQL schema-qualified e identificador quoted pelo driver.
5. `ConversationTurnService` com uma única transação para mensagem do usuário, análise, resposta e dashboard.
6. Idempotência por `(conversation_id, client_message_id)`.
7. Resposta somente após `COMMIT`, contendo IDs persistidos e `traceId`.
8. Rotas administrativas cross-tenant separadas, com RBAC e auditoria.

## Remover

- acesso a `public.copilot_*`;
- confiança em `tenant_id`, `user_id` ou `schema_name` enviados pelo frontend;
- gravações independentes de mensagem e dashboard;
- fallback silencioso para tenant, usuário, módulo ou conversa;
- cálculo oficial de métricas no frontend.

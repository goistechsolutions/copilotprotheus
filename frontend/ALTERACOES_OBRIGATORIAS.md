# Frontend do chat — alterações obrigatórias

## `useCopilotConversation.ts`

- remover snapshots completos de mensagens do `localStorage`;
- manter somente `activeConversationId` e preferências visuais;
- trocar as chamadas fire-and-forget por `POST /conversations/{id}/turns` aguardado;
- usar os IDs devolvidos pelo backend;
- expor retry quando a transação falhar.

## `copilotChatApi.ts`

- remover troca de módulo por regex;
- remover geração local de dashboard e IDs `dash-*`;
- não enviar `tenant_id`, `user_id` ou `schema_name` como autoridade;
- remover persistência separada de mensagem/dashboard;
- consumir `analysisId`, `dashboardId`, mensagens e apresentação persistidos.

## `chat.types.ts`

Acrescentar tipos `AnalysisContext`, `DashboardReference` e `TurnResponse` conforme o OpenAPI deste pacote.

## `CopilotChat.tsx`, `InlineChatDashboard.jsx`, `DashboardRenderer.jsx`

- abrir dashboard por `{dashboardId, analysisId}`;
- exportar por `analysisId`, sem reenviar dataset completo;
- renderizar `analysis.presentation`;
- remover mocks e cálculos de KPI/insight do bundle de produção.

## `useDashboardStore.js`

- limitar a store ao estado visual;
- remover `padrao`, `default_user`, `SIGAFAT` e IDs locais de conversa;
- carregar dashboard por `analysisId`, não pelo último JSON da conversa.

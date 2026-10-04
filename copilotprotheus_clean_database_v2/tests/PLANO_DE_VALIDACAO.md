# Plano de validação

## Bootstrap

- reset falha sem a frase de confirmação;
- reset remove os schemas cadastrados e recria `public` vazio;
- `public` não contém nenhuma tabela `copilot_*` conversacional;
- provisionamento recusa schema reservado ou inválido;
- tenant provisionado contém todas as tabelas obrigatórias.

## Integridade

- mensagens dependem de conversa;
- análise depende da mensagem de origem;
- mensagem de assistente e dashboard usam o mesmo `analysis_id`;
- dashboard é único por análise;
- `client_message_id` impede duplicidade;
- nenhuma tabela interna do tenant repete `tenant_id`.

## Segurança

- tenant A não lê IDs do tenant B;
- request com `schema_name` é rejeitado/ignorado;
- usuário sem acesso à empresa/ambiente é bloqueado;
- módulo não contratado é bloqueado;
- acesso administrativo cross-tenant é auditado.

## E2E

- criar tenant e provisionar schema;
- cadastrar usuário, empresa, ambiente, contrato e módulo;
- criar conversa e processar turno;
- fechar e reabrir conversa;
- abrir dashboard vinculado à mensagem correta;
- repetir com segundo tenant e comprovar isolamento;
- forçar falha antes do commit e comprovar ausência de registros parciais.

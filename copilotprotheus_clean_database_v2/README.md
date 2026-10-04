# Copilot Protheus — banco limpo v2

## Decisão

Este pacote substitui a estratégia de migração por **recriação integral da estrutura**.

- não copia dados legados;
- não cria tabelas `_legacy`;
- não faz dual-read ou dual-write;
- elimina o schema `public` atual e os schemas de tenant cadastrados, sob trava explícita;
- recria o control plane em `public`;
- cria um factory oficial para os schemas físicos dos tenants;
- projeta no tenant somente os módulos ativos do contrato;
- usa o dicionário/snapshot como allowlist de tabelas e campos, sem permissões físicas duplicadas;
- cria `analysis_id` desde a primeira versão;
- move toda persistência conversacional/analítica para o schema do tenant.

## Atenção

`00_destructive_reset.sql` é irreversível e apaga os objetos da base atual. Ele somente executa quando a sessão possuir:

```sql
SET copilot.allow_destructive_reset = 'RESET-COPILOT-PROTHEUS';
```

Use exclusivamente em uma base dedicada que possa ser descartada. O pacote não foi executado contra a instância real.

## Ordem de execução

```text
00_destructive_reset.sql
01_public_control_plane.sql
02_tenant_schema_factory.sql
03_create_initial_tenants.sql  (editar antes de executar)
04_verify_clean_structure.sql
```

Não há migration de dados. Cadastros, usuários, contratos, empresas, ambientes, conexões, dicionários e regras deverão ser configurados novamente por APIs administrativas ou seeds explicitamente revisados.

## Escopo dos aplicativos

- `frontend/`: chat do agente; consome conversas, mensagens, análises e dashboards pelo backend.
- `admin-frontend/`: painel de administração; configura o control plane e configurações empresariais por endpoints protegidos.
- `backend/`: única camada autorizada a resolver `tenant_code -> schema_name`, validar RBAC e executar SQL schema-qualified.

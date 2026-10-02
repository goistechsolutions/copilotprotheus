# Runbook de aplicacao (diagnostico de 02/10/2026)

## Estado confirmado
- Migration 20260930_001 aplicada; FK unica fk_tenant_module_contracts_module.
- Funcoes provision_tenant_schema(varchar) e migrate_legacy_tenant_metadata(varchar, ...) existem (002 e 003 instaladas).
- Extensao vector no schema public.
- Unico tenant: rodol_prd, schema_name = rodol_prd, provisioned_at vazio (factory nunca executada).
- View public.protheus_modules_legacy_compat existe (compatibilidade temporaria).

## Bloqueio
schema_name do tenant (rodol_prd) e o schema legado compartilhado. provision_tenant_schema('rodol_prd') nao cria o modelo novo:
tabelas homonimas ja existem com estrutura antiga e os indices em module_id falhariam.
migrate_legacy_tenant_metadata recusa origem = destino. Solucao: target_schema_name (tenant_rodol_prd).

## Ordem
1. Na VPS (antes de qualquer push que dispare deploy): bash scripts/apply_migrations.sh baseline 20260930_003_migrate_tenant_metadata_up.sql
2. Copiar para a VPS: database/migrations/20261002_001_tenant_target_schema_up.sql e scripts/staging_rehearsal.sh
3. Na VPS: bash scripts/staging_rehearsal.sh rodol_prd  (ensaio em copia; valida contagens)
4. Se passar: bash scripts/apply_migrations.sh apply  (aplica 004 e 20261002_001, com pg_dump antes)
5. Producao: SELECT public.provision_tenant_target_schema('rodol_prd'); depois SELECT public.migrate_tenant_to_target_schema('rodol_prd');
6. Validar contagens e isolamento. Nenhum DROP no legado ate o backend ler do novo schema.

## Rollback
- Dump em /root/backups/copilotprotheus. *_down.sql so manual.
- DROP SCHEMA tenant_rodol_prd CASCADE descarta o schema novo sem tocar no legado.

## Nao validado
- Nada foi executado em PostgreSQL real. O corpo de 20260930_003 nao foi lido: o wrapper assume que a migracao grava no schema indicado por public.tenant.schema_name.
- O ensaio pressupoe que o usuario copilot pode criar bancos e que dictionary_*.tenant_id guarda o tenant_code.

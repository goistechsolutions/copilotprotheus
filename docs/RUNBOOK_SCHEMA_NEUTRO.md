# Runbook - schema tecnico neutro por tenant

## Regra
- `public.tenant` representa o cliente contratante.
- `schema_name` e legado/compatibilidade e pode representar empresa/ambiente.
- `schema_key` e o nome tecnico canonico, derivado de `public.tenant.id`.
- Para id 1, o schema fisico e `tenant_1`.
- Nenhum dado de `rodol_prd` e copiado.

## Ordem
1. Aplicar `20261002_003_neutral_tenant_schema_up.sql` em staging.
2. Executar `SELECT public.provision_empty_tenant_schema('rodol_prd');`.
3. Validar que o retorno e `tenant_1`.
4. Validar as 12 tabelas esperadas e que todas estao vazias.
5. Validar que `rodol_prd` nao foi alterado.
6. Repetir em producao somente apos backup e revisao do PR.

## Comandos
```bash
bash scripts/apply_migrations.sh status
bash scripts/apply_migrations.sh apply
bash scripts/validate_empty_tenant_schema.sh rodol_prd
```

## Nao executar
- `migrate_legacy_tenant_metadata`.
- `migrate_tenant_to_target_schema`.
- `DROP SCHEMA rodol_prd`.
- `DROP TABLE` das estruturas legadas.

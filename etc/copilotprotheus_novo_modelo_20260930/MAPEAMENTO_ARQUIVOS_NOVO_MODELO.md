# Mapeamento de arquivos — novo modelo multi-tenant por schema

## Premissas confirmadas

- O catálogo canônico de módulos deve usar os campos:
  - `id` numérico, correspondente ao código real do módulo Protheus;
  - `module_sigla`, por exemplo `SIGAFAT`;
  - `description`, por exemplo `Vendas e Faturamento`.
- Registro canônico mínimo validado para a migração: `5 | SIGAFAT | Vendas e Faturamento`.
- O schema `public` mantém cadastro de tenants, contratos, catálogo mestre, usuários da plataforma, conectores, ambientes, licenciamento e auditoria global.
- Cada tenant possui schema próprio com catálogo/dicionário autorizado, regras, documentos/RAG, memórias, conversas, mensagens, análises e dashboards.
- O schema do tenant, e não tabelas adicionais de permissão de tabela/campo, é a allowlist de metadados consultáveis.
- Dados transacionais do Protheus não são replicados no PostgreSQL da plataforma.

## Evidência do banco atual

O inventário atual contém:

- `public.protheus_modules_master(id uuid, mod_code integer, mod_sigla varchar, mod_name varchar, description text, ...)`;
- `public.tenant_module_contracts(module_id uuid, ...)`;
- `public.business_domain_modules(mod_code integer, mod_sigla varchar, ...)`;
- `rodol_prd.tenant_table_permissions` e `rodol_prd.tenant_field_permissions`;
- tabelas de conversa/dashboard no schema `public`;
- catálogo, regras, documentos e memórias em `rodol_prd`;
- ausência de `copilot_analyses` no inventário CSV.

## Arquivos confirmados no repositório e ação proposta

> Regra: migrations históricas já aplicadas não devem ser editadas. Novas mudanças entram em novas migrations.

### Adicionar

- `database/migrations/20260930_001_module_catalog_numeric_up.sql`
- `database/migrations/20260930_001_module_catalog_numeric_down.sql`
- `database/migrations/20260930_002_tenant_schema_factory_up.sql`
- `database/migrations/20260930_002_tenant_schema_factory_down.sql`
- `database/migrations/20260930_003_migrate_tenant_metadata_up.sql`
- `database/migrations/20260930_003_migrate_tenant_metadata_down.sql`
- `database/migrations/20260930_004_post_migration_verification.sql`
- `scripts/map_new_model_references.sh`

### Alterar após leitura do conteúdo real

Arquivos cuja existência foi confirmada pela documentação do projeto:

- `.agents/AGENTS.md`: atualizar o identificador canônico do módulo para `id` numérico + `module_sigla` + `description`; registrar schema físico por tenant e a ausência de permissões redundantes de tabela/campo.
- `database/schema_v5_multitenant.sql`: alinhar a definição consolidada ao novo catálogo e ao factory de schema por tenant.
- `database/schema_v2_multitenancy.sql`: marcar como legado ou alinhar somente se ainda for usado para bootstrap novo; não reescrever se já foi aplicado como migration.
- `database/schema_knowledge_base.sql`: remover dependência de `tenant_id` das tabelas internas ao schema do tenant.
- `admin-frontend/src/services/companyModulesApi.js`: trocar o contrato de módulo UUID por `moduleId` numérico e retornar `moduleSigla`/`description`.
- `admin-frontend/src/pages/Companies.jsx`: consumir `schemaName` e o catálogo canônico.
- `admin-frontend/src/pages/CompanyDashboard.jsx`: exibir contratos/módulos pelo ID numérico.
- `admin-frontend/src/pages/Tenants.jsx`: incluir/validar `schema_name` imutável após provisionamento.
- `admin-frontend/src/pages/Licenses.jsx`: usar `moduleId` numérico nos contratos.
- `admin-frontend/src/pages/SnapshotsPage.jsx`: resolver módulo pelo novo catálogo.
- `admin-frontend/src/pages/Tables.jsx`: tratar o dicionário do schema do tenant como allowlist.
- `admin-frontend/src/pages/DictionarySyncPage.jsx`: sincronizar apenas para o schema autenticado/provisionado.
- `admin-frontend/src/pages/QueryGuardPage.jsx`: manter proteção de SQL, timeout e limites; remover dependência funcional das tabelas redundantes de permissão.
- `admin-frontend/src/pages/company/Dictionary.jsx`: usar o schema resolvido exclusivamente no backend.
- `admin-frontend/src/pages/governance/BusinessRulesPage.jsx`: persistir regras no schema do tenant.
- `admin-frontend/src/pages/governance/DomainsPage.jsx`: manter domínio separado de módulo e usar `moduleId` numérico.
- `admin-frontend/src/pages/governance/IntentsPage.jsx`: resolver domínio → módulo canônico.
- `admin-frontend/src/pages/governance/SemanticDictionaryPage.jsx`: separar templates globais de overlays por tenant.
- `admin-frontend/src/pages/governance/DashboardsPage.jsx`: referenciar `analysis_id`.

### Excluir ou substituir somente depois do cutover validado

- `admin-frontend/src/pages/PermissionEditorPage.jsx`: excluir se sua única função for editar permissões de tabela/campo; se também administrar papéis funcionais, substituí-la por uma tela simples de papéis da plataforma.
- `admin-frontend/src/pages/AgentRoles.jsx`: não excluir automaticamente. Reduzir para papéis funcionais (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `USER`) se o código real confirmar essa responsabilidade.

Tabelas candidatas a descontinuação, mas **não removidas automaticamente por este pacote**:

- `rodol_prd.tenant_table_permissions`;
- `rodol_prd.tenant_field_permissions`;
- `rodol_prd.company_info`, após consolidação no cadastro público e validação das diferenças de cardinalidade;
- `rodol_prd.business_field_aliases`, após migração do conteúdo semântico;
- regras tenant-specific no `public`, após cópia e validação no schema de cada tenant;
- conversas, mensagens e dashboards no `public`, após cópia, validação de contagem/hash e cutover do backend.

## Backend: arquivos a localizar antes da alteração

O conteúdo integral do backend não estava disponível no material recuperado. Portanto, nomes exatos de models/routes/services não são afirmados. Execute `scripts/map_new_model_references.sh` na raiz do repositório. Todo arquivo retornado para estes padrões deve ser revisado:

- `protheus_modules_master`, `mod_code`, `mod_sigla`, `mod_name`;
- `tenant_module_contracts`, `module_id`;
- `tenant_table_permissions`, `tenant_field_permissions`;
- `copilot_conversations`, `copilot_messages`, `copilot_dashboards`;
- `business_rule_tes`, `business_cfop_rules`, `business_financial_natures`;
- `rodol_prd`, `search_path`, `schema_name`;
- schemas Pydantic contendo módulo UUID;
- modelos SQLAlchemy contendo FK UUID para módulos;
- endpoints de contratos e módulos;
- serviços de provisionamento, sincronização de dicionário, RAG, conversas, análises e dashboards.

## Sequência de implantação

1. Backup lógico e teste de restauração.
2. Executar a migration 001 em homologação.
3. Ajustar backend e frontend para o contrato numérico.
4. Executar testes de contrato e isolamento.
5. Executar a migration 002 para instalar o factory.
6. Provisionar/corrigir `schema_name` de cada tenant por decisão explícita.
7. Executar a migration 003 por tenant, informando tenant e schema-fonte.
8. Validar com a migration 004.
9. Fazer o cutover das leituras/escritas.
10. Somente depois renomear/quarentenar estruturas legadas; exclusão física fica fora deste pacote para evitar perda de dados.

## Pendências obrigatórias antes de produção

- Ler integralmente `ESPECIFICACAO_TECNICA_COLABORACAO_IA_COPILOT_PROTHEUS.md`; o arquivo não foi localizado na busca disponível durante a geração deste pacote.
- Ler `PROJECT_MEMORY.md`; o arquivo também não foi localizado na busca disponível.
- Confirmar todas as FKs reais em `pg_constraint`.
- Confirmar se há módulos cujo `mod_code` seja nulo ou duplicado.
- Confirmar se existem referências a módulos além de `tenant_module_contracts`.
- Confirmar se `rodol_prd` representa um único tenant antes de copiar tabelas sem `tenant_id`.
- Confirmar política de retenção de conversas, prompts, SQL e dashboards.

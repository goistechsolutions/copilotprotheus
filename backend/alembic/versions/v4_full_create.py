"""v4_full_create: criação completa do schema V4 canônico

Revision ID: v4_full_create_001
Revises:     (nenhum — banco novo)
Create Date: 2026-07-26

Esta é a única migration do projeto. Cria as 29 tabelas do modelo V4
completo, na ordem correta de dependências (FK-safe).

Tabelas criadas (ordem de dependência):
  1.  tenants
  2.  companies
  3.  roles
  4.  permissions
  5.  users
  6.  role_permissions          (M2M)
  7.  user_roles                (M2M)
  8.  user_company_access       (M2M)
  9.  environments
  10. connectors
  11. license_plans
  12. tenant_contracts
  13. query_usage_counters
  14. concurrent_sessions
  15. protheus_modules_master
  16. tenant_module_contracts
  17. dictionary_snapshots
  18. tenant_dictionary_tables
  19. tenant_dictionary_fields
  20. tenant_dictionary_indexes
  21. tenant_allowed_tables
  22. tenant_allowed_fields
  23. knowledge_bases
  24. documents
  25. document_chunks
  26. memories
  27. tenant_schemas
  28. audit_logs
  29. agent_query_audit
  30. onboarding_projects
  31. onboarding_tasks

Seed:
  - 3 roles padrão: platform_admin, tenant_admin, tenant_user

Pré-requisitos:
  - PostgreSQL >= 14
  - pgvector instalado (CREATE EXTENSION vector)
  - uuid-ossp instalado (CREATE EXTENSION uuid-ossp)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision      = 'v4_full_create_001'
down_revision = None
branch_labels = None
depends_on    = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    import logging
    log = logging.getLogger("alembic")
    
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()
    
    existing_indexes = set()
    for t in existing_tables:
        try:
            for idx in inspector.get_indexes(t):
                existing_indexes.add(idx['name'])
        except Exception:
            pass

    orig_create_table = op.create_table
    def safe_create_table(table_name, *args, **kwargs):
        if table_name not in existing_tables:
            log.info(f"Creating table {table_name}")
            return orig_create_table(table_name, *args, **kwargs)
        log.info(f"Table {table_name} already exists, skipping")
    
    orig_create_index = op.create_index
    def safe_create_index(index_name, table_name, *args, **kwargs):
        if index_name not in existing_indexes:
            try:
                log.info(f"Creating index {index_name} on {table_name}")
                return orig_create_index(index_name, table_name, *args, **kwargs)
            except Exception as e:
                log.info(f"Skipped index {index_name}: {e}")
        else:
            log.info(f"Index {index_name} already exists, skipping")

    # Monkey patch the op object for this run
    op.create_table = safe_create_table
    op.create_index = safe_create_index

    # ── 0. Extensões obrigatórias ─────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── 1. tenants ────────────────────────────────────────────────────────
    op.create_table(
        'tenants',
        sa.Column('id',                          sa.String(100),  primary_key=True),
        sa.Column('name',                        sa.String(255),  nullable=True),
        sa.Column('tenant_code',                 sa.String(100),  nullable=True),
        sa.Column('tenant_name',                 sa.String(255),  nullable=True),
        sa.Column('protheus_rest_url',           sa.String(1024), nullable=True),
        sa.Column('protheus_user',               sa.String(255),  nullable=True),
        sa.Column('encrypted_protheus_password', sa.Text,         nullable=True),
        sa.Column('auth_mode',                   sa.String(50),   server_default='basic'),
        sa.Column('system_prompt',               sa.Text,         nullable=True),
        sa.Column('temperature',                 sa.Float,        server_default='0.2'),
        sa.Column('status',                      sa.String(50),   server_default='active'),
        sa.Column('plan_code',                   sa.String(50),   nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tenants_id',          'tenants', ['id'])
    op.create_index('ix_tenants_tenant_code', 'tenants', ['tenant_code'])

    # ── 2. companies ──────────────────────────────────────────────────────
    op.create_table(
        'companies',
        sa.Column('id',                          sa.Integer,      primary_key=True, autoincrement=True),
        sa.Column('tenant_id',                   sa.String(100),  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cnpj',                        sa.String(30),   nullable=True),
        sa.Column('ie',                          sa.String(30),   nullable=True),
        sa.Column('razao_social',                sa.String(255),  nullable=True),
        sa.Column('email',                       sa.String(255),  nullable=True),
        sa.Column('telefone',                    sa.String(50),   nullable=True),
        sa.Column('endereco',                    sa.String(500),  nullable=True),
        sa.Column('protheus_grupo',              sa.String(20),   nullable=True),
        sa.Column('protheus_empresa',            sa.String(20),   nullable=True),
        sa.Column('protheus_unidade',            sa.String(20),   nullable=True),
        sa.Column('protheus_filial',             sa.String(30),   nullable=True),
        sa.Column('protheus_ambientes',          sa.String(100),  server_default='producao'),
        sa.Column('protheus_usuario',            sa.String(100),  nullable=True),
        sa.Column('encrypted_protheus_password', sa.Text,         nullable=True),
        sa.Column('protheus_rest_url',           sa.String(1024), nullable=True),
        sa.Column('protheus_webapp_url',         sa.String(1024), nullable=True),
        sa.Column('licenca_uso',                 sa.Text,         nullable=True),
        sa.Column('status',                      sa.String(50),   server_default='ativa'),
        sa.Column('company_code',                sa.String(60),   nullable=True),
        sa.Column('company_name',                sa.String(200),  nullable=True),
        sa.Column('protheus_env',                sa.String(100),  nullable=True),
        sa.Column('protheus_branch',             sa.String(100),  nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_companies_id',        'companies', ['id'])
    op.create_index('ix_companies_tenant_id', 'companies', ['tenant_id'])
    op.create_index('ix_companies_cnpj',      'companies', ['cnpj'])

    # ── 3. roles ──────────────────────────────────────────────────────────
    op.create_table(
        'roles',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('role_code',   sa.String(60),  nullable=False, unique=True),
        sa.Column('role_name',   sa.String(120), nullable=False),
        sa.Column('scope_level', sa.String(30),  nullable=False),  # platform | tenant | company
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_roles_role_code', 'roles', ['role_code'])

    # ── 4. permissions ────────────────────────────────────────────────────
    op.create_table(
        'permissions',
        sa.Column('id',              UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('permission_code', sa.String(100), nullable=False, unique=True),
        sa.Column('permission_name', sa.String(150), nullable=False),
        sa.Column('module_name',     sa.String(80),  nullable=False),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_permissions_permission_code', 'permissions', ['permission_code'])

    # ── 5. users ──────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id',                UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',         sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('email',             sa.String(180), nullable=False, unique=True),
        sa.Column('full_name',         sa.String(180), nullable=False),
        sa.Column('password_hash',     sa.String(255), nullable=False),
        sa.Column('status',            sa.String(20),  nullable=False, server_default='active'),
        sa.Column('is_platform_admin', sa.Boolean,     nullable=False, server_default='false'),
        sa.Column('created_at',        sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',        sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_users_tenant_id', 'users', ['tenant_id'])
    op.create_index('ix_users_email',     'users', ['email'])

    # ── 6. role_permissions (M2M) ─────────────────────────────────────────
    op.create_table(
        'role_permissions',
        sa.Column('role_id',       UUID(as_uuid=True), sa.ForeignKey('roles.id',       ondelete='CASCADE'), primary_key=True),
        sa.Column('permission_id', UUID(as_uuid=True), sa.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    )

    # ── 7. user_roles (M2M) ───────────────────────────────────────────────
    op.create_table(
        'user_roles',
        sa.Column('user_id',    UUID(as_uuid=True), sa.ForeignKey('users.id',     ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id',    UUID(as_uuid=True), sa.ForeignKey('roles.id',     ondelete='CASCADE'), primary_key=True),
        sa.Column('tenant_id',  sa.String(100),     sa.ForeignKey('tenants.id',   ondelete='CASCADE'), primary_key=True),
        sa.Column('company_id', sa.Integer,         sa.ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True),
    )

    # ── 8. user_company_access (M2M) ──────────────────────────────────────
    # environments ainda nao existe; criada após. FK adicionada depois via ALTER.
    op.create_table(
        'user_company_access',
        sa.Column('user_id',    UUID(as_uuid=True), sa.ForeignKey('users.id',     ondelete='CASCADE'), primary_key=True),
        sa.Column('tenant_id',  sa.String(100),     sa.ForeignKey('tenants.id',   ondelete='CASCADE'), primary_key=True),
        sa.Column('company_id', sa.Integer,         sa.ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('env_id',     UUID(as_uuid=True), nullable=True),  # FK adicionada em step 9b
    )

    # ── 9. environments ───────────────────────────────────────────────────
    op.create_table(
        'environments',
        sa.Column('id',               UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',        sa.String(100), sa.ForeignKey('tenants.id',   ondelete='CASCADE'), nullable=False),
        sa.Column('company_id',       sa.Integer,     sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('env_code',         sa.String(60),  nullable=False),
        sa.Column('env_name',         sa.String(120), nullable=False),
        sa.Column('api_base_url',     sa.String(500), nullable=True),
        sa.Column('middleware_route', sa.String(500), nullable=True),
        sa.Column('status',           sa.String(20),  nullable=False, server_default='active'),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',       sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_environments_tenant_id', 'environments', ['tenant_id'])
    op.create_index('ix_environments_company_id','environments', ['company_id'])

    # ── 9b. FK de user_company_access.env_id → environments ───────────────
    op.create_foreign_key(
        'fk_uca_env_id', 'user_company_access',
        'environments', ['env_id'], ['id'], ondelete='CASCADE'
    )

    # ── 10. connectors ────────────────────────────────────────────────────
    op.create_table(
        'connectors',
        sa.Column('id',             UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',      sa.String(100), sa.ForeignKey('tenants.id',      ondelete='CASCADE'),  nullable=False),
        sa.Column('company_id',     sa.Integer,     sa.ForeignKey('companies.id',    ondelete='SET NULL'), nullable=True),
        sa.Column('env_id',         UUID(as_uuid=True), sa.ForeignKey('environments.id', ondelete='CASCADE'), nullable=True),
        sa.Column('connector_type', sa.String(50),  nullable=False),
        sa.Column('connector_name', sa.String(150), nullable=False),
        sa.Column('base_url',       sa.String(500), nullable=True),
        sa.Column('auth_type',      sa.String(50),  nullable=True),
        sa.Column('secret_ref',     sa.String(200), nullable=True),
        sa.Column('status',         sa.String(20),  nullable=False, server_default='active'),
        sa.Column('created_at',     sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',     sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_connectors_tenant_id',  'connectors', ['tenant_id'])
    op.create_index('ix_connectors_company_id', 'connectors', ['company_id'])
    op.create_index('ix_connectors_env_id',     'connectors', ['env_id'])

    # ── 11. license_plans ─────────────────────────────────────────────────
    op.create_table(
        'license_plans',
        sa.Column('id',                        UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('plan_code',                 sa.String(60),  nullable=False, unique=True),
        sa.Column('plan_name',                 sa.String(150), nullable=False),
        sa.Column('billing_cycle',             sa.String(20),  nullable=False, server_default='monthly'),
        sa.Column('query_limit',               sa.Integer,     nullable=True),
        sa.Column('concurrent_sessions_limit', sa.Integer,     nullable=True),
        sa.Column('overage_mode',              sa.String(20),  nullable=False, server_default='block'),
        sa.Column('active',                    sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_license_plans_plan_code', 'license_plans', ['plan_code'])

    # ── 12. tenant_contracts ──────────────────────────────────────────────
    op.create_table(
        'tenant_contracts',
        sa.Column('id',                           UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',                    sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id',                      UUID(as_uuid=True), sa.ForeignKey('license_plans.id'), nullable=True),
        sa.Column('contract_code',                sa.String(80),  nullable=False, unique=True),
        sa.Column('contract_status',              sa.String(20),  nullable=False, server_default='active'),
        sa.Column('starts_at',                    sa.Date,        nullable=False),
        sa.Column('ends_at',                      sa.Date,        nullable=True),
        sa.Column('query_limit_override',         sa.Integer,     nullable=True),
        sa.Column('concurrent_sessions_override', sa.Integer,     nullable=True),
        sa.Column('overage_mode_override',        sa.String(20),  nullable=True),
        sa.Column('notes',                        sa.Text,        nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tenant_contracts_tenant_id', 'tenant_contracts', ['tenant_id'])

    # ── 13. query_usage_counters ──────────────────────────────────────────
    op.create_table(
        'query_usage_counters',
        sa.Column('id',              UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',       sa.String(100), sa.ForeignKey('tenants.id',        ondelete='CASCADE'), nullable=False),
        sa.Column('contract_id',     UUID(as_uuid=True), sa.ForeignKey('tenant_contracts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_ref',      sa.String(20),  nullable=False),
        sa.Column('total_queries',   sa.Integer,     nullable=False, server_default='0'),
        sa.Column('blocked_queries', sa.Integer,     nullable=False, server_default='0'),
        sa.Column('overage_queries', sa.Integer,     nullable=False, server_default='0'),
        sa.Column('updated_at',      sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_query_usage_counters_tenant_id', 'query_usage_counters', ['tenant_id'])

    # ── 14. concurrent_sessions ───────────────────────────────────────────
    op.create_table(
        'concurrent_sessions',
        sa.Column('id',             UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',      sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',        UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_key',    sa.String(120), nullable=False, unique=True),
        sa.Column('started_at',     sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at',     sa.DateTime(timezone=True), nullable=True),
        sa.Column('session_status', sa.String(20),  nullable=False, server_default='active'),
    )
    op.create_index('ix_concurrent_sessions_tenant_id',   'concurrent_sessions', ['tenant_id'])
    op.create_index('ix_concurrent_sessions_session_key', 'concurrent_sessions', ['session_key'])

    # ── 15. protheus_modules_master ───────────────────────────────────────
    op.create_table(
        'protheus_modules_master',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('module_code', sa.String(30),  nullable=False, unique=True),
        sa.Column('module_name', sa.String(150), nullable=False),
        sa.Column('source_name', sa.String(60),  nullable=False, server_default='SYS_USR_MODULE'),
        sa.Column('active',      sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_protheus_modules_master_module_code', 'protheus_modules_master', ['module_code'])

    # ── 16. tenant_module_contracts ───────────────────────────────────────
    op.create_table(
        'tenant_module_contracts',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',   sa.String(100), sa.ForeignKey('tenants.id',              ondelete='CASCADE'), nullable=False),
        sa.Column('contract_id', UUID(as_uuid=True), sa.ForeignKey('tenant_contracts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id',   UUID(as_uuid=True), sa.ForeignKey('protheus_modules_master.id'), nullable=False),
        sa.Column('status',      sa.String(20),  nullable=False, server_default='allowed'),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_tenant_module_contracts_tenant_id', 'tenant_module_contracts', ['tenant_id'])

    # ── 18. tenant_dictionary_tables ──────────────────────────────────────
    op.create_table(
        'tenant_dictionary_tables',
        sa.Column('id',               sa.BigInteger, primary_key=True),
        sa.Column('tenant_id',        sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id',       sa.String(100), nullable=True),
        sa.Column('environment_id',   sa.String(100), nullable=False, server_default='producao'),
        sa.Column('table_name',       sa.String(30),  nullable=False),
        sa.Column('table_alias',      sa.String(80),  nullable=True),
        sa.Column('module_code',      sa.String(10),  nullable=True),
        sa.Column('description',      sa.Text,        nullable=True),
        sa.Column('physical_name',    sa.String(80),  nullable=True),
        sa.Column('active_flag',      sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('raw_payload',      postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',       sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_tdt_tenant_id', 'tenant_dictionary_tables', ['tenant_id'])
    op.create_index('ix_tdt_table_name', 'tenant_dictionary_tables', ['table_name'])

    # ── 21. tenant_allowed_tables ─────────────────────────────────────────
    op.create_table(
        'tenant_allowed_tables',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',   sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('table_name',  sa.String(30),  nullable=False),
        sa.Column('module_code', sa.String(30),  nullable=True),
        sa.Column('active',      sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tat_tenant_id', 'tenant_allowed_tables', ['tenant_id'])
    op.create_index('ix_tat_table_name', 'tenant_allowed_tables', ['table_name'])

    # ── 23. knowledge_bases ───────────────────────────────────────────────
    op.create_table(
        'knowledge_bases',
        sa.Column('id',               UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',        sa.String(100), sa.ForeignKey('tenants.id',   ondelete='CASCADE'),  nullable=False),
        sa.Column('company_id',       sa.Integer,     sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('kb_code',          sa.String(60),  nullable=False),
        sa.Column('kb_name',          sa.String(200), nullable=False),
        sa.Column('storage_type',     sa.String(50),  nullable=False, server_default='r2'),
        sa.Column('storage_prefix',   sa.String(500), nullable=False),
        sa.Column('vector_collection',sa.String(200), nullable=True),
        sa.Column('status',           sa.String(20),  nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_knowledge_bases_tenant_id', 'knowledge_bases', ['tenant_id'])

    # ── 24. documents ─────────────────────────────────────────────────────
    op.create_table(
        'documents',
        sa.Column('id',          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('tenant_id',   sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, server_default='default'),
        sa.Column('visibility',  sa.String(20),  nullable=False, server_default='tenant'),
        sa.Column('title',       sa.String(255), nullable=False),
        sa.Column('source_path', sa.String(1024),nullable=False),
        sa.Column('source_type', sa.String(50),  nullable=True),
        sa.Column('module',      sa.String(100), nullable=True),
        sa.Column('category',    sa.String(100), nullable=True),
        sa.Column('version',     sa.String(50),  nullable=True),
        sa.Column('status',      sa.String(50),  nullable=True),
        sa.Column('checksum',    sa.String(64),  unique=True),
        sa.Column('language',    sa.String(10),  nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_documents_id',        'documents', ['id'])
    op.create_index('ix_documents_tenant_id', 'documents', ['tenant_id'])
    op.create_index('ix_documents_visibility','documents', ['visibility'])
    op.create_index('ix_documents_checksum',  'documents', ['checksum'])

    # ── 25. document_chunks ───────────────────────────────────────────────
    op.create_table(
        'document_chunks',
        sa.Column('id',              sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('document_id',     sa.Integer, sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_order',     sa.Integer, nullable=False),
        sa.Column('content',         sa.Text,    nullable=False),
        sa.Column('token_count',     sa.Integer, nullable=True),
        sa.Column('embedding_model', sa.String(100), nullable=True),
        # vector(3072) = text-embedding-3-large
        sa.Column('vector',          sa.Text,    nullable=True),   # placeholder; convertido abaixo
        sa.Column('page_number',     sa.Integer, nullable=True),
        sa.Column('section',         sa.String(255), nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_document_chunks_id',          'document_chunks', ['id'])
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])
    # Converte coluna para vector(3072) após criação da tabela
    op.execute("""
        ALTER TABLE document_chunks
        ALTER COLUMN vector TYPE vector(3072)
        USING NULL::vector(3072)
    """)

    # ── 26. memories ──────────────────────────────────────────────────────
    op.create_table(
        'memories',
        sa.Column('id',           sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('tenant_id',    sa.String(100), sa.ForeignKey('tenants.id',   ondelete='CASCADE'),  nullable=False, server_default='default'),
        sa.Column('company_id',   sa.Integer,     sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('visibility',   sa.String(20),  nullable=False, server_default='tenant'),
        sa.Column('memory_key',   sa.String(255), nullable=False),
        sa.Column('memory_value', sa.Text,        nullable=False),
        sa.Column('memory_type',  sa.String(50),  nullable=True),
        sa.Column('scope',        sa.String(100), nullable=True),
        sa.Column('tags',         JSONB,          nullable=True),
        sa.Column('confidence',   sa.Integer,     nullable=True),
        sa.Column('source',       sa.String(255), nullable=True),
        sa.Column('expires_at',   sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',   sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_memories_id',         'memories', ['id'])
    op.create_index('ix_memories_tenant_id',  'memories', ['tenant_id'])
    op.create_index('ix_memories_company_id', 'memories', ['company_id'])
    op.create_index('ix_memories_visibility', 'memories', ['visibility'])
    op.create_index('ix_memories_memory_key', 'memories', ['memory_key'])

    # ── 27. tenant_schemas ────────────────────────────────────────────────
    op.create_table(
        'tenant_schemas',
        sa.Column('id',          sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('tenant_id',   sa.String(100), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('modulo',      sa.String(50),  nullable=True),
        sa.Column('chave',       sa.String(10),  nullable=False),
        sa.Column('tabela',      sa.String(50),  nullable=True),
        sa.Column('nome',        sa.String(255), nullable=True),
        sa.Column('schema_json', JSONB,          nullable=False),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tenant_schemas_id',        'tenant_schemas', ['id'])
    op.create_index('ix_tenant_schemas_tenant_id', 'tenant_schemas', ['tenant_id'])
    op.create_index('ix_tenant_schemas_modulo',    'tenant_schemas', ['modulo'])
    op.create_index('ix_tenant_schemas_chave',     'tenant_schemas', ['chave'])

    # ── 28. audit_logs ────────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id',           UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',    sa.String(100), sa.ForeignKey('tenants.id',   ondelete='SET NULL'), nullable=True),
        sa.Column('company_id',   sa.Integer,     sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id',      sa.String(100), nullable=True),
        sa.Column('module_name',  sa.String(80),  nullable=False),
        sa.Column('action_name',  sa.String(120), nullable=False),
        sa.Column('target_type',  sa.String(80),  nullable=True),
        sa.Column('target_id',    sa.String(120), nullable=True),
        sa.Column('request_id',   sa.String(120), nullable=True),
        sa.Column('details_json', JSONB,          nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_audit_logs_tenant_id',  'audit_logs', ['tenant_id'])
    op.create_index('ix_audit_logs_company_id', 'audit_logs', ['company_id'])

    # ── 29. agent_query_audit ─────────────────────────────────────────────
    op.create_table(
        'agent_query_audit',
        sa.Column('id',                      UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',               sa.String(100), sa.ForeignKey('tenants.id',           ondelete='CASCADE'), nullable=False),
        sa.Column('company_id',              sa.Integer,     sa.ForeignKey('companies.id',         ondelete='SET NULL'), nullable=True),
        sa.Column('env_id',                  UUID(as_uuid=True), sa.ForeignKey('environments.id'), nullable=True),
        sa.Column('user_id',                 UUID(as_uuid=True), sa.ForeignKey('users.id'),        nullable=True),
        sa.Column('contract_id',             UUID(as_uuid=True), sa.ForeignKey('tenant_contracts.id'), nullable=True),
        sa.Column('request_id',              sa.String(120), nullable=True),
        sa.Column('natural_language_prompt', sa.Text,        nullable=True),
        sa.Column('generated_sql',           sa.Text,        nullable=True),
        sa.Column('sql_hash',                sa.String(128), nullable=True),
        sa.Column('execution_status',        sa.String(20),  nullable=False, server_default='planned'),
        sa.Column('rows_returned',           sa.Integer,     nullable=True),
        sa.Column('response_time_ms',        sa.Integer,     nullable=True),
        sa.Column('blocked_reason',          sa.String(255), nullable=True),
        sa.Column('tables_used',             sa.Text,        nullable=True),
        sa.Column('created_at',              sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_aqa_tenant_id',  'agent_query_audit', ['tenant_id'])
    op.create_index('ix_aqa_company_id', 'agent_query_audit', ['company_id'])
    op.create_index('ix_aqa_sql_hash',   'agent_query_audit', ['sql_hash'])

    # ── 30. onboarding_projects ───────────────────────────────────────────
    op.create_table(
        'onboarding_projects',
        sa.Column('id',                  UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id',           sa.String(100), sa.ForeignKey('tenants.id',   ondelete='CASCADE'),  nullable=False),
        sa.Column('company_id',          sa.Integer,     sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('project_code',        sa.String(60),  nullable=False),
        sa.Column('project_name',        sa.String(180), nullable=False),
        sa.Column('onboarding_status',   sa.String(30),  nullable=False, server_default='planned'),
        sa.Column('go_live_target_date', sa.Date,        nullable=True),
        sa.Column('owner_name',          sa.String(180), nullable=True),
        sa.Column('owner_email',         sa.String(180), nullable=True),
        sa.Column('created_at',          sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',          sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_onboarding_projects_tenant_id', 'onboarding_projects', ['tenant_id'])

    # ── 31. onboarding_tasks ──────────────────────────────────────────────
    op.create_table(
        'onboarding_tasks',
        sa.Column('id',                    UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('onboarding_project_id', UUID(as_uuid=True), sa.ForeignKey('onboarding_projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_code',             sa.String(80),  nullable=False),
        sa.Column('task_name',             sa.String(200), nullable=False),
        sa.Column('task_type',             sa.String(50),  nullable=False),
        sa.Column('mandatory',             sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('task_status',           sa.String(30),  nullable=False, server_default='pending'),
        sa.Column('assigned_to',           sa.String(180), nullable=True),
        sa.Column('due_date',              sa.Date,        nullable=True),
        sa.Column('created_at',            sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',            sa.DateTime(timezone=True), nullable=True),
    )

    # ── SEED: roles padrão da plataforma ──────────────────────────────────
    op.execute("""
        INSERT INTO roles (id, role_code, role_name, scope_level, created_at)
        VALUES
          (uuid_generate_v4(), 'platform_admin', 'Administrador da Plataforma', 'platform', now()),
          (uuid_generate_v4(), 'tenant_admin',   'Administrador do Tenant',     'tenant',   now()),
          (uuid_generate_v4(), 'tenant_user',    'Usuário do Tenant',           'tenant',   now())
        ON CONFLICT (role_code) DO NOTHING
    """)


def downgrade() -> None:
    """Drop de todas as tabelas na ordem inversa (FK-safe)."""
    tables = [
        'onboarding_tasks',
        'onboarding_projects',
        'agent_query_audit',
        'audit_logs',
        'tenant_schemas',
        'memories',
        'document_chunks',
        'documents',
        'knowledge_bases',
        'tenant_allowed_tables',
        'tenant_dictionary_tables',
        'tenant_module_contracts',
        'protheus_modules_master',
        'concurrent_sessions',
        'query_usage_counters',
        'tenant_contracts',
        'license_plans',
        'connectors',
        'environments',
        'user_company_access',
        'user_roles',
        'role_permissions',
        'users',
        'permissions',
        'roles',
        'companies',
        'tenants',
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")

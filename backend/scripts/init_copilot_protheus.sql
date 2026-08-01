-- ============================================================
-- SCRIPT DE CRIAÇÃO COMPLETA — copilot_protheus
-- Gerado a partir de: backend/app/models/knowledge.py
-- Arquitetura: Multi-tenant via schemas PostgreSQL
-- ============================================================

-- EXTENSÃO
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SCHEMA PUBLIC — Tabelas Globais de Plataforma
-- ============================================================

-- tenant_registry
CREATE TABLE IF NOT EXISTS public.tenant_registry (
    id               SERIAL PRIMARY KEY,
    tenant_code      VARCHAR(50)  NOT NULL UNIQUE,
    tenant_name      VARCHAR(150) NOT NULL,
    schema_name      VARCHAR(63)  NOT NULL UNIQUE,
    status           VARCHAR(20)  NOT NULL DEFAULT 'provisioning',
    plan_code        VARCHAR(50),
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    provisioned_at   TIMESTAMP,
    decommissioned_at TIMESTAMP
);

-- plans
CREATE TABLE IF NOT EXISTS public.plans (
    plan_code         VARCHAR(50)  PRIMARY KEY,
    plan_name         VARCHAR(150) NOT NULL,
    max_users         INTEGER      DEFAULT 5,
    max_queries_day   INTEGER      DEFAULT 500,
    modules_allowed   JSONB        DEFAULT '[]',
    active            BOOLEAN      DEFAULT TRUE
);

-- license_plans
CREATE TABLE IF NOT EXISTS public.license_plans (
    id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code                    VARCHAR(60)  NOT NULL UNIQUE,
    plan_name                    VARCHAR(150) NOT NULL,
    billing_cycle                VARCHAR(20)  NOT NULL DEFAULT 'monthly',
    query_limit                  INTEGER,
    concurrent_sessions_limit    INTEGER,
    overage_mode                 VARCHAR(20)  NOT NULL DEFAULT 'block',
    active                       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ
);

-- platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_superadmin BOOLEAN      DEFAULT FALSE,
    active        BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- protheus_modules_master
CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mod_code     VARCHAR(30) UNIQUE,
    module_code  VARCHAR(30) UNIQUE,
    mod_name     VARCHAR(150),
    module_name  VARCHAR(150),
    description  TEXT,
    source_name  VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

-- users
CREATE TABLE IF NOT EXISTS public.users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         VARCHAR(100),
    email             VARCHAR(180) NOT NULL UNIQUE,
    full_name         VARCHAR(180) NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'active',
    is_platform_admin BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON public.users(tenant_id);

-- roles
CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_code   VARCHAR(60)  NOT NULL UNIQUE,
    role_name   VARCHAR(120) NOT NULL,
    scope_level VARCHAR(30)  NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_code  VARCHAR(100) NOT NULL UNIQUE,
    permission_name  VARCHAR(150) NOT NULL,
    module_name      VARCHAR(80)  NOT NULL,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       UUID REFERENCES public.roles(id)       ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id    UUID         REFERENCES public.users(id) ON DELETE CASCADE,
    role_id    UUID         REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id  VARCHAR(100) NOT NULL,
    company_id INTEGER      NOT NULL,
    PRIMARY KEY (user_id, role_id, tenant_id, company_id)
);

-- user_company_access
CREATE TABLE IF NOT EXISTS public.user_company_access (
    user_id    UUID         NOT NULL,
    tenant_id  VARCHAR(100) NOT NULL,
    company_id INTEGER      NOT NULL,
    env_id     UUID,
    PRIMARY KEY (user_id, tenant_id, company_id)
);

-- environments
CREATE TABLE IF NOT EXISTS public.environments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        VARCHAR(100) NOT NULL,
    company_id       INTEGER,
    env_code         VARCHAR(60)  NOT NULL,
    env_name         VARCHAR(120) NOT NULL,
    api_base_url     VARCHAR(500),
    middleware_route VARCHAR(500),
    status           VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_environments_tenant_id  ON public.environments(tenant_id);
CREATE INDEX IF NOT EXISTS ix_environments_company_id ON public.environments(company_id);

-- connectors
CREATE TABLE IF NOT EXISTS public.connectors (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      VARCHAR(100) NOT NULL,
    company_id     INTEGER,
    env_id         UUID,
    connector_type VARCHAR(50)  NOT NULL,
    connector_name VARCHAR(150) NOT NULL,
    base_url       VARCHAR(500),
    auth_type      VARCHAR(50),
    secret_ref     VARCHAR(200),
    status         VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_connectors_tenant_id  ON public.connectors(tenant_id);
CREATE INDEX IF NOT EXISTS ix_connectors_company_id ON public.connectors(company_id);
CREATE INDEX IF NOT EXISTS ix_connectors_env_id     ON public.connectors(env_id);

-- tenant_contracts
CREATE TABLE IF NOT EXISTS public.tenant_contracts (
    id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                    VARCHAR(100) NOT NULL,
    plan_id                      UUID REFERENCES public.license_plans(id),
    contract_code                VARCHAR(80)  NOT NULL UNIQUE,
    contract_status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    starts_at                    DATE         NOT NULL,
    ends_at                      DATE,
    query_limit_override         INTEGER,
    concurrent_sessions_override INTEGER,
    overage_mode_override        VARCHAR(20),
    notes                        TEXT,
    created_at                   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_tenant_contracts_tenant_id ON public.tenant_contracts(tenant_id);

-- query_usage_counters
CREATE TABLE IF NOT EXISTS public.query_usage_counters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       VARCHAR(100) NOT NULL,
    contract_id     UUID         NOT NULL,
    period_ref      VARCHAR(20)  NOT NULL,
    total_queries   INTEGER      NOT NULL DEFAULT 0,
    blocked_queries INTEGER      NOT NULL DEFAULT 0,
    overage_queries INTEGER      NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_query_usage_counters_tenant_id ON public.query_usage_counters(tenant_id);

-- concurrent_sessions
CREATE TABLE IF NOT EXISTS public.concurrent_sessions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      VARCHAR(100) NOT NULL,
    user_id        UUID,
    session_key    VARCHAR(120) NOT NULL UNIQUE,
    started_at     TIMESTAMPTZ  DEFAULT NOW(),
    expires_at     TIMESTAMPTZ,
    session_status VARCHAR(20)  NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS ix_concurrent_sessions_tenant_id ON public.concurrent_sessions(tenant_id);

-- tenant_module_contracts
CREATE TABLE IF NOT EXISTS public.tenant_module_contracts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   VARCHAR(100) NOT NULL,
    contract_id UUID         NOT NULL,
    module_id   UUID         NOT NULL REFERENCES public.protheus_modules_master(id),
    status      VARCHAR(20)  NOT NULL DEFAULT 'allowed',
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_tenant_module_contracts_tenant_id ON public.tenant_module_contracts(tenant_id);

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    VARCHAR(100),
    company_id   INTEGER,
    user_id      VARCHAR(100),
    module_name  VARCHAR(80)  NOT NULL,
    action_name  VARCHAR(120) NOT NULL,
    target_type  VARCHAR(80),
    target_id    VARCHAR(120),
    request_id   VARCHAR(120),
    details_json JSONB,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id  ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_company_id ON public.audit_logs(company_id);

-- agent_users (legado)
CREATE TABLE IF NOT EXISTS public.agent_users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     VARCHAR(100),
    email         VARCHAR(180),
    full_name     VARCHAR(180),
    password_hash VARCHAR(255),
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_agent_users_tenant_id ON public.agent_users(tenant_id);

-- agent_roles (legado)
CREATE TABLE IF NOT EXISTS public.agent_roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   VARCHAR(100),
    role_code   VARCHAR(60),
    role_name   VARCHAR(120),
    scope_level VARCHAR(30),
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_agent_roles_tenant_id ON public.agent_roles(tenant_id);

-- agent_query_audit (global — plataforma)
CREATE TABLE IF NOT EXISTS public.agent_query_audit (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               VARCHAR(100) NOT NULL,
    company_id              INTEGER,
    env_id                  UUID,
    user_id                 UUID,
    contract_id             UUID,
    snapshot_id             UUID,
    request_id              VARCHAR(120),
    natural_language_prompt TEXT,
    generated_sql           TEXT,
    sql_hash                VARCHAR(128),
    execution_status        VARCHAR(20) NOT NULL DEFAULT 'planned',
    rows_returned           INTEGER,
    response_time_ms        INTEGER,
    blocked_reason          VARCHAR(255),
    tables_used             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_agent_query_audit_global_tenant_id ON public.agent_query_audit(tenant_id);
CREATE INDEX IF NOT EXISTS ix_agent_query_audit_global_sql_hash  ON public.agent_query_audit(sql_hash);

-- platform_audit_log
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_code VARCHAR(50),
    actor       VARCHAR(150),
    action      VARCHAR(100) NOT NULL,
    detail      JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- tenant_allowed_tables
CREATE TABLE IF NOT EXISTS public.tenant_allowed_tables (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   VARCHAR(100) NOT NULL,
    table_name  VARCHAR(30)  NOT NULL,
    module_code VARCHAR(30),
    description TEXT,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    CONSTRAINT uq_tenant_allowed_table UNIQUE (tenant_id, table_name)
);
CREATE INDEX IF NOT EXISTS ix_tenant_allowed_tables_tenant_id  ON public.tenant_allowed_tables(tenant_id);
CREATE INDEX IF NOT EXISTS ix_tenant_allowed_tables_table_name ON public.tenant_allowed_tables(table_name);

-- dictionary_snapshots (public — usada por admin)
CREATE TABLE IF NOT EXISTS public.dictionary_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       VARCHAR(100) NOT NULL,
    company_id      VARCHAR(100),
    environment_id  VARCHAR(100) NOT NULL DEFAULT 'producao',
    snapshot_code   VARCHAR(60)  NOT NULL UNIQUE,
    snapshot_status VARCHAR(20)  NOT NULL DEFAULT 'pending',
    total_tables    INTEGER      DEFAULT 0,
    total_fields    INTEGER      DEFAULT 0,
    source_type     VARCHAR(30)  DEFAULT 'api',
    notes           TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_dictionary_snapshots_tenant_id ON public.dictionary_snapshots(tenant_id);

-- tenant_dictionary_tables (public — usada por admin)
CREATE TABLE IF NOT EXISTS public.tenant_dictionary_tables (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(100) NOT NULL,
    company_id     VARCHAR(100),
    environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
    snapshot_code  VARCHAR(60)  NOT NULL,
    table_name     VARCHAR(30)  NOT NULL,
    table_alias    VARCHAR(80),
    module_code    VARCHAR(10),
    description    TEXT,
    physical_name  VARCHAR(80),
    active_flag    BOOLEAN      NOT NULL DEFAULT TRUE,
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_tenant_dict_tables_tenant_id     ON public.tenant_dictionary_tables(tenant_id);
CREATE INDEX IF NOT EXISTS ix_tenant_dict_tables_snapshot_code ON public.tenant_dictionary_tables(snapshot_code);
CREATE INDEX IF NOT EXISTS ix_tenant_dict_tables_table_name    ON public.tenant_dictionary_tables(table_name);


-- ============================================================
-- FUNÇÃO PARA PROVISIONAR SCHEMA DE TENANT
-- Chamada por: POST /admin/tenants  (provision endpoint)
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_tenant_schema(p_schema TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema);

  -- company_info
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.company_info (
      id                          SERIAL PRIMARY KEY,
      tenant_id                   VARCHAR(100),
      company_code                VARCHAR(60)  NOT NULL,
      branch_code                 VARCHAR(60)  NOT NULL,
      company_name                VARCHAR(200) NOT NULL,
      cnpj                        VARCHAR(30),
      ie                          VARCHAR(30),
      razao_social                VARCHAR(255),
      email                       VARCHAR(255),
      telefone                    VARCHAR(50),
      endereco                    VARCHAR(500),
      protheus_grupo              VARCHAR(20),
      protheus_empresa            VARCHAR(20),
      protheus_unidade            VARCHAR(20),
      protheus_filial             VARCHAR(30),
      environment                 VARCHAR(60)  DEFAULT ''producao'',
      protheus_ambientes          VARCHAR(100) DEFAULT ''producao'',
      webapp_url                  TEXT,
      protheus_rest_url           TEXT,
      protheus_usuario            VARCHAR(100),
      encrypted_protheus_password TEXT,
      auth_mode                   VARCHAR(30)  DEFAULT ''basic'',
      status                      VARCHAR(20)  DEFAULT ''active'',
      system_prompt               TEXT,
      temperature                 NUMERIC(3,2) DEFAULT 0.20,
      created_at                  TIMESTAMP    DEFAULT NOW(),
      updated_at                  TIMESTAMP    DEFAULT NOW(),
      CONSTRAINT uq_company_info_code_branch UNIQUE (company_code, branch_code)
    )', p_schema);

  -- protheus_modules
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.protheus_modules (
      id           SERIAL PRIMARY KEY,
      tenant_id    VARCHAR(100) NOT NULL,
      company_code VARCHAR(60),
      modulo       VARCHAR(50)  NOT NULL,
      codmod       VARCHAR(50)  NOT NULL,
      usr_modulo   VARCHAR(50),
      usr_codmod   VARCHAR(50),
      usr_nome     VARCHAR(255),
      created_at   TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_prot_mod_tenant ON %I.protheus_modules(tenant_id)', replace(p_schema,'-','_'), p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_prot_mod_modulo ON %I.protheus_modules(modulo)',  replace(p_schema,'-','_'), p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_prot_mod_codmod ON %I.protheus_modules(codmod)',  replace(p_schema,'-','_'), p_schema);

  -- tenant_schemas
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.tenant_schemas (
      id          SERIAL PRIMARY KEY,
      tenant_id   VARCHAR(100) NOT NULL,
      modulo      VARCHAR(50)  NOT NULL,
      codmod      VARCHAR(50),
      chave       VARCHAR(10)  NOT NULL,
      tabela      VARCHAR(50),
      nome        VARCHAR(255),
      schema_json JSONB        NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_ten_sch_tenant ON %I.tenant_schemas(tenant_id)',  replace(p_schema,'-','_'), p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_ten_sch_modulo ON %I.tenant_schemas(modulo)',    replace(p_schema,'-','_'), p_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%s_ten_sch_chave  ON %I.tenant_schemas(chave)',     replace(p_schema,'-','_'), p_schema);

  -- dictionary_snapshots (tenant copy)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.dictionary_snapshots (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id       VARCHAR(100) NOT NULL,
      company_id      VARCHAR(100),
      environment_id  VARCHAR(100) NOT NULL DEFAULT ''producao'',
      snapshot_code   VARCHAR(60)  NOT NULL UNIQUE,
      snapshot_status VARCHAR(20)  NOT NULL DEFAULT ''pending'',
      total_tables    INTEGER      DEFAULT 0,
      total_fields    INTEGER      DEFAULT 0,
      source_type     VARCHAR(30)  DEFAULT ''api'',
      notes           TEXT,
      created_at      TIMESTAMPTZ  DEFAULT NOW(),
      finished_at     TIMESTAMPTZ
    )', p_schema);

  -- dictionary_tables
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.dictionary_tables (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      snapshot_code  VARCHAR(60)  NOT NULL,
      table_name     VARCHAR(30)  NOT NULL,
      table_alias    VARCHAR(80),
      module_code    VARCHAR(10),
      description    TEXT,
      physical_name  VARCHAR(80),
      active_flag    BOOLEAN      NOT NULL DEFAULT TRUE,
      raw_payload    JSONB,
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- dictionary_fields
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.dictionary_fields (
      id              BIGSERIAL PRIMARY KEY,
      tenant_id       VARCHAR(100) NOT NULL,
      company_id      VARCHAR(100),
      environment_id  VARCHAR(100) NOT NULL DEFAULT ''producao'',
      snapshot_code   VARCHAR(60)  NOT NULL,
      table_name      VARCHAR(30)  NOT NULL,
      field_name      VARCHAR(30)  NOT NULL,
      title           VARCHAR(120),
      field_type      VARCHAR(5),
      length_num      INTEGER,
      decimal_num     INTEGER,
      required_flag   BOOLEAN      NOT NULL DEFAULT FALSE,
      browse_flag     BOOLEAN      NOT NULL DEFAULT FALSE,
      virtual_flag    BOOLEAN      NOT NULL DEFAULT FALSE,
      validation_rule TEXT,
      relation_rule   TEXT,
      when_rule       TEXT,
      raw_payload     JSONB,
      created_at      TIMESTAMPTZ  DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- dictionary_indexes
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.dictionary_indexes (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      snapshot_code  VARCHAR(60)  NOT NULL,
      table_name     VARCHAR(30)  NOT NULL,
      index_order    VARCHAR(10)  NOT NULL,
      nickname       VARCHAR(80),
      expression     TEXT,
      raw_payload    JSONB,
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- dictionary_groups
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.dictionary_groups (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      snapshot_code  VARCHAR(60)  NOT NULL,
      group_name     VARCHAR(80)  NOT NULL,
      description    TEXT,
      raw_payload    JSONB,
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- tenant_dictionary_sources
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.tenant_dictionary_sources (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      source_type    VARCHAR(20)  NOT NULL,
      snapshot_code  VARCHAR(60)  NOT NULL,
      status         VARCHAR(20)  NOT NULL DEFAULT ''pending'',
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      started_at     TIMESTAMPTZ,
      finished_at    TIMESTAMPTZ,
      error_message  TEXT
    )', p_schema);

  -- tenant_table_permissions
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.tenant_table_permissions (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      role_id        VARCHAR(100) NOT NULL,
      table_name     VARCHAR(30)  NOT NULL,
      can_list       BOOLEAN      NOT NULL DEFAULT FALSE,
      can_describe   BOOLEAN      NOT NULL DEFAULT FALSE,
      can_query      BOOLEAN      NOT NULL DEFAULT FALSE,
      approved_by    VARCHAR(100),
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- tenant_field_permissions
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.tenant_field_permissions (
      id             BIGSERIAL PRIMARY KEY,
      tenant_id      VARCHAR(100) NOT NULL,
      company_id     VARCHAR(100),
      environment_id VARCHAR(100) NOT NULL DEFAULT ''producao'',
      role_id        VARCHAR(100) NOT NULL,
      table_name     VARCHAR(30)  NOT NULL,
      field_name     VARCHAR(30)  NOT NULL,
      can_select     BOOLEAN      NOT NULL DEFAULT FALSE,
      can_filter     BOOLEAN      NOT NULL DEFAULT FALSE,
      masked_flag    BOOLEAN      NOT NULL DEFAULT FALSE,
      approved_by    VARCHAR(100),
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- memories
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.memories (
      id           SERIAL PRIMARY KEY,
      tenant_id    VARCHAR(100) NOT NULL DEFAULT ''default'',
      company_id   INTEGER,
      visibility   VARCHAR(20)  NOT NULL DEFAULT ''tenant'',
      memory_key   VARCHAR(255) NOT NULL,
      memory_value TEXT         NOT NULL,
      memory_type  VARCHAR(50),
      scope        VARCHAR(100),
      tags         JSONB,
      confidence   INTEGER,
      source       VARCHAR(255),
      expires_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ  DEFAULT NOW(),
      updated_at   TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- documents
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.documents (
      id          SERIAL PRIMARY KEY,
      tenant_id   VARCHAR(100) NOT NULL DEFAULT ''default'',
      visibility  VARCHAR(20)  NOT NULL DEFAULT ''tenant'',
      title       VARCHAR(255) NOT NULL,
      source_path VARCHAR(1024) NOT NULL,
      source_type VARCHAR(50),
      module      VARCHAR(100),
      category    VARCHAR(100),
      version     VARCHAR(50),
      status      VARCHAR(50),
      checksum    VARCHAR(64),
      language    VARCHAR(10),
      created_at  TIMESTAMPTZ  DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  DEFAULT NOW()
    )', p_schema);

  -- document_chunks
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.document_chunks (
      id              SERIAL PRIMARY KEY,
      document_id     INTEGER NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      chunk_order     INTEGER NOT NULL,
      content         TEXT    NOT NULL,
      token_count     INTEGER,
      embedding_model VARCHAR(100),
      page_number     INTEGER,
      section         VARCHAR(255),
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )', p_schema, p_schema);

  -- agent_query_audit (tenant)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.agent_query_audit (
      id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id               VARCHAR(100) NOT NULL,
      company_id              INTEGER,
      env_id                  UUID,
      user_id                 UUID,
      contract_id             UUID,
      snapshot_id             UUID,
      request_id              VARCHAR(120),
      natural_language_prompt TEXT,
      generated_sql           TEXT,
      sql_hash                VARCHAR(128),
      execution_status        VARCHAR(20) NOT NULL DEFAULT ''planned'',
      rows_returned           INTEGER,
      response_time_ms        INTEGER,
      blocked_reason          VARCHAR(255),
      tables_used             TEXT,
      created_at              TIMESTAMPTZ DEFAULT NOW()
    )', p_schema);

END;
$$;


-- ============================================================
-- DADOS INICIAIS (Seeds)
-- ============================================================

-- Plano padrão
INSERT INTO public.license_plans (plan_code, plan_name, billing_cycle, query_limit, concurrent_sessions_limit, overage_mode, active)
VALUES ('starter', 'Starter', 'monthly', 1000, 5, 'block', TRUE)
ON CONFLICT (plan_code) DO NOTHING;

-- Roles padrão
INSERT INTO public.roles (role_code, role_name, scope_level) VALUES
  ('platform_admin', 'Platform Admin',  'platform'),
  ('tenant_admin',   'Tenant Admin',    'tenant'),
  ('analyst',        'Analyst',         'company'),
  ('viewer',         'Viewer',          'company')
ON CONFLICT (role_code) DO NOTHING;

-- Módulos Protheus master
INSERT INTO public.protheus_modules_master (mod_code, module_code, mod_name, module_name, description, active) VALUES
  ('SIGAFAT', 'SIGAFAT', 'Faturamento',       'Faturamento',       'Módulo de Faturamento',                   TRUE),
  ('SIGAEST', 'SIGAEST', 'Estoque',           'Estoque',           'Módulo de Controle de Estoque',           TRUE),
  ('SIGAFIN', 'SIGAFIN', 'Financeiro',        'Financeiro',        'Módulo Financeiro',                       TRUE),
  ('SIGAFIS', 'SIGAFIS', 'Fiscal',            'Fiscal',            'Módulo Fiscal',                           TRUE),
  ('SIGACOM', 'SIGACOM', 'Compras',           'Compras',           'Módulo de Compras',                       TRUE),
  ('SIGAGPE', 'SIGAGPE', 'Gestão de Pessoal', 'Gestão de Pessoal', 'Módulo RH / Folha de Pagamento',          TRUE),
  ('SIGAMNT', 'SIGAMNT', 'Manutenção',        'Manutenção',        'Módulo de Manutenção',                    TRUE),
  ('SIGAPCP', 'SIGAPCP', 'PCP',               'PCP',               'Planejamento e Controle da Produção',     TRUE),
  ('SIGACONT','SIGACONT','Contabilidade',      'Contabilidade',     'Módulo de Contabilidade (CTBA)',           TRUE),
  ('SIGAATF', 'SIGAATF', 'Ativo Fixo',        'Ativo Fixo',        'Módulo de Ativo Imobilizado',             TRUE)
ON CONFLICT (module_code) DO NOTHING;

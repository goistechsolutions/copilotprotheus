BEGIN;

CREATE TABLE IF NOT EXISTS license_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(60) NOT NULL UNIQUE,
    plan_name VARCHAR(150) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    query_limit INTEGER,
    concurrent_sessions_limit INTEGER,
    overage_mode VARCHAR(20) NOT NULL DEFAULT 'block',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_id UUID REFERENCES license_plans(id),
    contract_code VARCHAR(80) NOT NULL UNIQUE,
    contract_status VARCHAR(20) NOT NULL DEFAULT 'active',
    starts_at DATE NOT NULL,
    ends_at DATE,
    query_limit_override INTEGER,
    concurrent_sessions_override INTEGER,
    overage_mode_override VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protheus_modules_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code VARCHAR(30) NOT NULL UNIQUE,
    module_name VARCHAR(150) NOT NULL,
    source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_module_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contract_id UUID NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES protheus_modules_master(id),
    status VARCHAR(20) NOT NULL DEFAULT 'allowed',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_id, module_id)
);

CREATE TABLE IF NOT EXISTS dictionary_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_id UUID REFERENCES companies(id),
    env_id UUID REFERENCES environments(id),
    snapshot_code VARCHAR(80) NOT NULL,
    source_db_type VARCHAR(30) NOT NULL DEFAULT 'oracle',
    source_label VARCHAR(150),
    sync_mode VARCHAR(20) NOT NULL DEFAULT 'full',
    sync_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    requested_by UUID REFERENCES users(id),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    total_modules INTEGER DEFAULT 0,
    total_tables INTEGER DEFAULT 0,
    total_fields INTEGER DEFAULT 0,
    total_indexes INTEGER DEFAULT 0,
    notes TEXT,
    UNIQUE (tenant_id, snapshot_code)
);

CREATE TABLE IF NOT EXISTS tenant_dictionary_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES dictionary_snapshots(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_id UUID REFERENCES companies(id),
    env_id UUID REFERENCES environments(id),
    module_code VARCHAR(30),
    table_key VARCHAR(20) NOT NULL,
    physical_name VARCHAR(30) NOT NULL,
    table_name VARCHAR(255),
    unique_index_expr TEXT,
    x2_tamfil NUMERIC(10,2),
    x2_modo VARCHAR(5),
    x2_tamun NUMERIC(10,2),
    x2_modoun VARCHAR(5),
    x2_tamemp NUMERIC(10,2),
    x2_modoemp VARCHAR(5),
    usa_empresa CHAR(1) NOT NULL DEFAULT 'N',
    usa_unidade CHAR(1) NOT NULL DEFAULT 'N',
    usa_filial CHAR(1) NOT NULL DEFAULT 'N',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, table_key, physical_name)
);

CREATE TABLE IF NOT EXISTS tenant_dictionary_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES dictionary_snapshots(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    table_id UUID NOT NULL REFERENCES tenant_dictionary_tables(id) ON DELETE CASCADE,
    field_name VARCHAR(40) NOT NULL,
    field_description VARCHAR(255),
    field_type VARCHAR(5),
    field_length NUMERIC(10,2),
    field_order INTEGER,
    sxg_group VARCHAR(20),
    sxg_size NUMERIC(10,2),
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    mask_rule VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (table_id, field_name)
);

CREATE TABLE IF NOT EXISTS tenant_dictionary_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES dictionary_snapshots(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    table_id UUID NOT NULL REFERENCES tenant_dictionary_tables(id) ON DELETE CASCADE,
    index_order INTEGER,
    index_nickname VARCHAR(80),
    index_expression TEXT NOT NULL,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary_hint BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_allowed_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contract_id UUID NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES dictionary_snapshots(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tenant_dictionary_tables(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'query',
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    rationale VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_id, snapshot_id, table_id)
);

CREATE TABLE IF NOT EXISTS tenant_allowed_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    allowed_table_id UUID NOT NULL REFERENCES tenant_allowed_tables(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES tenant_dictionary_fields(id) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    masking_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (allowed_table_id, field_id)
);

CREATE TABLE IF NOT EXISTS query_usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contract_id UUID NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
    period_ref VARCHAR(20) NOT NULL,
    total_queries INTEGER NOT NULL DEFAULT 0,
    blocked_queries INTEGER NOT NULL DEFAULT 0,
    overage_queries INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_id, period_ref)
);

CREATE TABLE IF NOT EXISTS concurrent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    session_key VARCHAR(120) NOT NULL UNIQUE,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    session_status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS agent_query_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_id UUID REFERENCES companies(id),
    env_id UUID REFERENCES environments(id),
    user_id UUID REFERENCES users(id),
    contract_id UUID REFERENCES tenant_contracts(id),
    snapshot_id UUID REFERENCES dictionary_snapshots(id),
    request_id VARCHAR(120),
    natural_language_prompt TEXT,
    generated_sql TEXT,
    sql_hash VARCHAR(128),
    execution_status VARCHAR(20) NOT NULL DEFAULT 'planned',
    rows_returned INTEGER,
    response_time_ms INTEGER,
    blocked_reason VARCHAR(255),
    tables_used TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dictionary_snapshots_tenant ON dictionary_snapshots(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictionary_tables_snapshot ON tenant_dictionary_tables(snapshot_id, module_code, table_key);
CREATE INDEX IF NOT EXISTS idx_dictionary_fields_table ON tenant_dictionary_fields(table_id, field_name);
CREATE INDEX IF NOT EXISTS idx_dictionary_indexes_table ON tenant_dictionary_indexes(table_id, index_order);
CREATE INDEX IF NOT EXISTS idx_allowed_tables_tenant ON tenant_allowed_tables(tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_query_usage_tenant_period ON query_usage_counters(tenant_id, period_ref);
CREATE INDEX IF NOT EXISTS idx_agent_query_audit_tenant_created ON agent_query_audit(tenant_id, created_at DESC);

COMMIT;

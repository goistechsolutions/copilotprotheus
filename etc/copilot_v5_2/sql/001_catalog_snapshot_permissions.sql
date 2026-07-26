CREATE TABLE IF NOT EXISTS tenant_dictionary_sources (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('SX2','SX3','SXG','SIX')),
    snapshot_code VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    error_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS dictionary_tables (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    snapshot_code VARCHAR(60) NOT NULL,
    table_name VARCHAR(30) NOT NULL,
    table_alias VARCHAR(80) NULL,
    module_code VARCHAR(10) NULL,
    description TEXT NULL,
    physical_name VARCHAR(80) NULL,
    active_flag BOOLEAN NOT NULL DEFAULT TRUE,
    raw_payload JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, snapshot_code, table_name)
);

CREATE TABLE IF NOT EXISTS dictionary_fields (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    snapshot_code VARCHAR(60) NOT NULL,
    table_name VARCHAR(30) NOT NULL,
    field_name VARCHAR(30) NOT NULL,
    title VARCHAR(120) NULL,
    field_type VARCHAR(5) NULL,
    length_num INTEGER NULL,
    decimal_num INTEGER NULL,
    required_flag BOOLEAN NOT NULL DEFAULT FALSE,
    browse_flag BOOLEAN NOT NULL DEFAULT FALSE,
    virtual_flag BOOLEAN NOT NULL DEFAULT FALSE,
    validation_rule TEXT NULL,
    relation_rule TEXT NULL,
    when_rule TEXT NULL,
    raw_payload JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, snapshot_code, table_name, field_name)
);

CREATE TABLE IF NOT EXISTS dictionary_indexes (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    snapshot_code VARCHAR(60) NOT NULL,
    table_name VARCHAR(30) NOT NULL,
    index_order VARCHAR(10) NOT NULL,
    nickname VARCHAR(80) NULL,
    expression TEXT NULL,
    raw_payload JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, snapshot_code, table_name, index_order)
);

CREATE TABLE IF NOT EXISTS dictionary_groups (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    snapshot_code VARCHAR(60) NOT NULL,
    group_name VARCHAR(80) NOT NULL,
    description TEXT NULL,
    raw_payload JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, snapshot_code, group_name)
);

CREATE TABLE IF NOT EXISTS tenant_table_permissions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    role_id UUID NOT NULL,
    table_name VARCHAR(30) NOT NULL,
    can_list BOOLEAN NOT NULL DEFAULT FALSE,
    can_describe BOOLEAN NOT NULL DEFAULT FALSE,
    can_query BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, role_id, table_name)
);

CREATE TABLE IF NOT EXISTS tenant_field_permissions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NULL,
    environment_id UUID NOT NULL,
    role_id UUID NOT NULL,
    table_name VARCHAR(30) NOT NULL,
    field_name VARCHAR(30) NOT NULL,
    can_select BOOLEAN NOT NULL DEFAULT FALSE,
    can_filter BOOLEAN NOT NULL DEFAULT FALSE,
    masked_flag BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, environment_id, role_id, table_name, field_name)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_tables_lookup
    ON dictionary_tables (tenant_id, environment_id, table_name);
CREATE INDEX IF NOT EXISTS idx_dictionary_fields_lookup
    ON dictionary_fields (tenant_id, environment_id, table_name, field_name);
CREATE INDEX IF NOT EXISTS idx_dictionary_indexes_lookup
    ON dictionary_indexes (tenant_id, environment_id, table_name);
CREATE INDEX IF NOT EXISTS idx_perm_table_lookup
    ON tenant_table_permissions (tenant_id, environment_id, role_id, table_name);
CREATE INDEX IF NOT EXISTS idx_perm_field_lookup
    ON tenant_field_permissions (tenant_id, environment_id, role_id, table_name, field_name);

-- =====================================================================
-- 002_tenant_module_contracts_support.sql
-- Migration/SQL de apoio para persistência de módulos por empresa
-- Compatibilizado com a Arquitetura Única V4
-- =====================================================================

-- Extensão UUID (se não existir)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela Mestra de Módulos do Protheus (protheus_modules_master)
CREATE TABLE IF NOT EXISTS protheus_modules_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code VARCHAR(30) NOT NULL UNIQUE,
    module_name VARCHAR(120) NOT NULL,
    source_name VARCHAR(50) NOT NULL DEFAULT 'SYS_USR_MODULE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS ix_protheus_modules_master_module_code ON protheus_modules_master (module_code);

-- Contratos / Vínculo de Módulos por Tenant (tenant_module_contracts)
CREATE TABLE IF NOT EXISTS tenant_module_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES protheus_modules_master(id),
    status VARCHAR(20) NOT NULL DEFAULT 'allowed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contract_id, module_id)
);
CREATE INDEX IF NOT EXISTS ix_tenant_module_contracts_tenant_id ON tenant_module_contracts (tenant_id);

-- Tabela de Tabelas Permitidas do Dicionário (tenant_allowed_tables)
CREATE TABLE IF NOT EXISTS tenant_allowed_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES dictionary_snapshots(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tenant_dictionary_tables(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'query',
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    rationale VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS ix_tat_tenant_id ON tenant_allowed_tables (tenant_id);

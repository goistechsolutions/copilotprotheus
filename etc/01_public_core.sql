-- =========================================================
-- NÚCLEO GLOBAL DA PLATAFORMA (schema: public)
-- Dados compartilhados entre todos os tenants
-- =========================================================

CREATE TABLE IF NOT EXISTS tenant_registry (
    id              SERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50) UNIQUE NOT NULL CHECK (tenant_code ~ '^[a-z0-9_]+$'),
    tenant_name     VARCHAR(150) NOT NULL,
    schema_name     VARCHAR(63) UNIQUE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'provisioning'
                        CHECK (status IN ('provisioning','active','suspended','decommissioned')),
    plan_code       VARCHAR(50),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    provisioned_at  TIMESTAMP,
    decommissioned_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
    plan_code       VARCHAR(50) PRIMARY KEY,
    plan_name       VARCHAR(150) NOT NULL,
    max_users       INTEGER DEFAULT 5,
    max_queries_day INTEGER DEFAULT 500,
    modules_allowed JSONB DEFAULT '[]',
    active          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS platform_admins (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_superadmin   BOOLEAN DEFAULT FALSE,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protheus_modules_master (
    mod_code        VARCHAR(30) PRIMARY KEY,
    mod_name        VARCHAR(150) NOT NULL,
    description     TEXT
);

CREATE TABLE IF NOT EXISTS platform_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50),
    actor            VARCHAR(150),
    action          VARCHAR(100) NOT NULL,
    detail          JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tenant_registry_status ON tenant_registry(status);
CREATE INDEX IF NOT EXISTS ix_audit_tenant_code ON platform_audit_log(tenant_code);

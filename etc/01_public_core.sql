-- =========================================================
-- NÚCLEO GLOBAL DA PLATAFORMA (schema: public)
-- Dados compartilhados entre todos os tenants
-- =========================================================

CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.tenant_registry (
    id              SERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50) UNIQUE NOT NULL CHECK (tenant_code ~ '^[a-z0-9_]+$'),
    tenant_name     VARCHAR(150) NOT NULL,
    schema_name     VARCHAR(63) UNIQUE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'provisioning'
                        CHECK (status IN ('provisioning','active','suspended','decommissioned')),
    plan_code       VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    provisioned_at  TIMESTAMP,
    decommissioned_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.plans (
    plan_code       VARCHAR(50) PRIMARY KEY,
    plan_name       VARCHAR(150) NOT NULL,
    max_users       INTEGER DEFAULT 5,
    max_queries_day INTEGER DEFAULT 500,
    modules_allowed JSONB DEFAULT '[]',
    active          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_superadmin   BOOLEAN DEFAULT FALSE,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mod_code        VARCHAR(30) UNIQUE,
    module_code     VARCHAR(30) UNIQUE,
    mod_name        VARCHAR(150),
    module_name     VARCHAR(150),
    description     TEXT,
    source_name     VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50),
    actor            VARCHAR(150),
    action          VARCHAR(100) NOT NULL,
    detail          JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tenant_registry_status ON public.tenant_registry(status);
CREATE INDEX IF NOT EXISTS ix_audit_tenant_code ON public.platform_audit_log(tenant_code);

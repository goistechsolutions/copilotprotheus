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
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
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
    mod_code        VARCHAR(30) PRIMARY KEY,
    mod_name        VARCHAR(150) NOT NULL,
    description     TEXT
);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50),
    actor            VARCHAR(150),
    action          VARCHAR(100) NOT NULL,
    detail          JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id                          VARCHAR(100) PRIMARY KEY,
    name                        VARCHAR(255),
    tenant_code                 VARCHAR(100),
    tenant_name                 VARCHAR(255),
    protheus_rest_url           VARCHAR(1024),
    protheus_user               VARCHAR(255),
    encrypted_protheus_password TEXT,
    auth_mode                   VARCHAR(50) DEFAULT 'basic',
    system_prompt               TEXT,
    temperature                 FLOAT DEFAULT 0.2,
    status                      VARCHAR(50) DEFAULT 'active',
    plan_code                   VARCHAR(50),
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.companies (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   VARCHAR(100),
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
    protheus_ambientes          VARCHAR(100) DEFAULT 'producao',
    protheus_usuario            VARCHAR(100),
    encrypted_protheus_password TEXT,
    protheus_rest_url           VARCHAR(1024),
    protheus_webapp_url         VARCHAR(1024),
    licenca_uso                 TEXT,
    status                      VARCHAR(50) DEFAULT 'ativa',
    company_code                VARCHAR(60),
    company_name                VARCHAR(200),
    protheus_env                VARCHAR(100),
    protheus_branch             VARCHAR(100),
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_tenant_registry_status ON public.tenant_registry(status);
CREATE INDEX IF NOT EXISTS ix_audit_tenant_code ON public.platform_audit_log(tenant_code);
CREATE INDEX IF NOT EXISTS ix_tenants_tenant_code ON public.tenants(tenant_code);
CREATE INDEX IF NOT EXISTS ix_companies_tenant_id ON public.companies(tenant_id);

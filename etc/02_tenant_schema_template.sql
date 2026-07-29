-- =========================================================
-- TEMPLATE DE SCHEMA POR TENANT
-- Substituir {{schema}} pelo nome real (ex: tenant_elitecorp)
-- =========================================================

CREATE SCHEMA IF NOT EXISTS "{{schema}}";

-- Dados cadastrais e conexão com o Protheus
CREATE TABLE IF NOT EXISTS "{{schema}}".company_info (
    id                      SERIAL PRIMARY KEY,
    company_code            VARCHAR(20) NOT NULL,
    branch_code              VARCHAR(20) NOT NULL,
    company_name            VARCHAR(150) NOT NULL,
    environment            VARCHAR(60) NOT NULL,
    webapp_url               TEXT,
    protheus_rest_url        TEXT,
    protheus_usuario         VARCHAR(100),
    encrypted_protheus_password TEXT,
    auth_mode                VARCHAR(30) DEFAULT 'basic',
    status                   VARCHAR(20) DEFAULT 'active',
    system_prompt            TEXT,
    temperature               NUMERIC(3,2) DEFAULT 0.20,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    UNIQUE (company_code, branch_code)
);

-- Usuários locais do tenant (acesso ao painel/agente)
CREATE TABLE IF NOT EXISTS "{{schema}}".users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(30) NOT NULL DEFAULT 'viewer',
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "{{schema}}".permissions (
    id          SERIAL PRIMARY KEY,
    role        VARCHAR(30) NOT NULL,
    resource    VARCHAR(100) NOT NULL,
    can_read    BOOLEAN DEFAULT TRUE,
    can_write   BOOLEAN DEFAULT FALSE,
    UNIQUE (role, resource)
);

-- Módulos contratados (recorte do catálogo global protheus_modules_master)
CREATE TABLE IF NOT EXISTS "{{schema}}".module_contracts (
    id          SERIAL PRIMARY KEY,
    mod_code    VARCHAR(30) NOT NULL,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (mod_code)
);

-- Dicionário de dados curado (apenas o que a empresa usa/customiza)
CREATE TABLE IF NOT EXISTS "{{schema}}".dictionary_tables (
    id              SERIAL PRIMARY KEY,
    table_name      VARCHAR(30) NOT NULL,
    mod_code        VARCHAR(30),
    description     VARCHAR(255),
    usa_filial      BOOLEAN DEFAULT FALSE,
    usa_empresa     BOOLEAN DEFAULT FALSE,
    usa_unidade     BOOLEAN DEFAULT FALSE,
    allowed         BOOLEAN DEFAULT TRUE,
    synced_at       TIMESTAMP,
    UNIQUE (table_name)
);

CREATE TABLE IF NOT EXISTS "{{schema}}".dictionary_fields (
    id              SERIAL PRIMARY KEY,
    table_name      VARCHAR(30) NOT NULL REFERENCES "{{schema}}".dictionary_tables(table_name) ON DELETE CASCADE,
    field_name      VARCHAR(30) NOT NULL,
    field_desc      VARCHAR(255),
    field_type      VARCHAR(20),
    field_size      INTEGER,
    allowed         BOOLEAN DEFAULT TRUE,
    UNIQUE (table_name, field_name)
);

-- Regras e processos específicos da empresa (usados em memória pelo agente)
CREATE TABLE IF NOT EXISTS "{{schema}}".custom_rules (
    id          SERIAL PRIMARY KEY,
    rule_key    VARCHAR(100) NOT NULL UNIQUE,
    rule_value  TEXT NOT NULL,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Auditoria de uso do agente (consumo, consultas geradas, etc.)
CREATE TABLE IF NOT EXISTS "{{schema}}".query_audit (
    id              BIGSERIAL PRIMARY KEY,
    user_email      VARCHAR(150),
    question        TEXT,
    generated_sql   TEXT,
    tables_used     JSONB,
    response_time_ms INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_{{schema}}_dict_tables_mod ON "{{schema}}".dictionary_tables(mod_code);
CREATE INDEX IF NOT EXISTS ix_{{schema}}_query_audit_date ON "{{schema}}".query_audit(created_at);

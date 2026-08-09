-- DDL COMPLETO — Copilot Protheus V5 Multi-Tenant
-- Banco: copilot_protheus
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTENSÕES ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA PUBLIC — Governança da Plataforma
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PLANOS DE ASSINATURA ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
    plan_code           VARCHAR(50)  PRIMARY KEY,
    plan_name           VARCHAR(150) NOT NULL,
    max_users           INTEGER      NOT NULL DEFAULT 5,
    max_queries_day     INTEGER      NOT NULL DEFAULT 500,
    modules_allowed     JSONB        NOT NULL DEFAULT '[]',
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── CATÁLOGO GLOBAL DE MÓDULOS PROTHEUS ────────────────────────────────────
-- Alimentado via: SELECT DISTINCT USR_MODULO, USR_CODMOD FROM SYS_USR_MODULE
CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    mod_code    INTEGER      NOT NULL,  -- USR_MODULO (1, 2, 3... 97)
    mod_sigla   VARCHAR(30)  UNIQUE,    -- USR_CODMOD (SIGAFIN, SIGAFAT...)
    mod_name    VARCHAR(150) NOT NULL,  -- Nome completo (SIGAFIN - Financeiro)
    description TEXT,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    UNIQUE(mod_code)
);
CREATE INDEX IF NOT EXISTS idx_pmm_code   ON public.protheus_modules_master(mod_code);
CREATE INDEX IF NOT EXISTS idx_pmm_sigla  ON public.protheus_modules_master(mod_sigla);

-- ─── REGISTRO DE TENANTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_registry (
    id                  SERIAL       PRIMARY KEY,
    tenant_code         VARCHAR(50)  NOT NULL UNIQUE, -- slug: "acme"
    tenant_name         VARCHAR(150) NOT NULL,
    schema_name         VARCHAR(63)  NOT NULL UNIQUE, -- nome real do schema PG
    plan_code           VARCHAR(50)  REFERENCES public.plans(plan_code),
    status              VARCHAR(20)  NOT NULL DEFAULT 'provisioning'
                            CHECK (status IN ('provisioning','active','suspended','decommissioned')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    provisioned_at      TIMESTAMPTZ,
    decommissioned_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tr_code   ON public.tenant_registry(tenant_code);
CREATE INDEX IF NOT EXISTS idx_tr_status ON public.tenant_registry(status);

-- ─── ADMINISTRADORES DA PLATAFORMA ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id              SERIAL       PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    is_superadmin   BOOLEAN      NOT NULL DEFAULT FALSE,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── USUÁRIOS (MULTI-TENANT) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(100) NOT NULL REFERENCES public.tenant_registry(tenant_code) ON DELETE CASCADE,
    email           VARCHAR(180) NOT NULL UNIQUE,
    full_name       VARCHAR(180) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','blocked')),
    is_platform_admin BOOLEAN    NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);

-- ─── CONTROLE DE ACESSO RBAC ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code   VARCHAR(60) NOT NULL UNIQUE,
    role_name   VARCHAR(120) NOT NULL,
    scope_level VARCHAR(30) NOT NULL DEFAULT 'tenant', -- 'platform' | 'tenant'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(150) NOT NULL,
    module_name     VARCHAR(80)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       UUID REFERENCES public.roles(id)       ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id    UUID        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id  VARCHAR(100) NOT NULL,
    company_id INTEGER     NOT NULL DEFAULT 0,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id, tenant_id, company_id)
);

-- ─── AUDITORIA GLOBAL ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    tenant_code VARCHAR(50),
    actor       VARCHAR(150),
    action      VARCHAR(100) NOT NULL,
    detail      JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pal_tenant    ON public.platform_audit_log(tenant_code);
CREATE INDEX IF NOT EXISTS idx_pal_action    ON public.platform_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pal_created   ON public.platform_audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNÇÃO: Provisiona schema de tenant automaticamente
-- Chamada pelo backend ao cadastrar nova empresa
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.provision_tenant_schema(p_schema VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Cria o schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema);

    -- ── company_info ──────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.company_info (
            id                          SERIAL       PRIMARY KEY,
            tenant_id                   VARCHAR(100) NOT NULL,
            company_code                VARCHAR(60)  NOT NULL,
            branch_code                 VARCHAR(60)  NOT NULL DEFAULT ''0101'',
            company_name                VARCHAR(200) NOT NULL,
            cnpj                        VARCHAR(30),
            razao_social                VARCHAR(255),
            email                       VARCHAR(255),
            telefone                    VARCHAR(50),
            protheus_rest_url           VARCHAR(500),
            protheus_usuario            VARCHAR(100),
            encrypted_protheus_password VARCHAR(500),
            auth_mode                   VARCHAR(30)  DEFAULT ''basic'',
            environment                 VARCHAR(30)  DEFAULT ''producao'',
            active                      BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ,
            UNIQUE(company_code, branch_code)
        )', p_schema);

    -- ── protheus_modules ──────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.protheus_modules (
            id          BIGSERIAL    PRIMARY KEY,
            tenant_id   VARCHAR(100) NOT NULL,
            mod_code    INTEGER      NOT NULL,
            mod_sigla   VARCHAR(30)  NOT NULL,
            mod_name    VARCHAR(150) NOT NULL,
            active      BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            UNIQUE(tenant_id, mod_code)
        )', p_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_pm_code  ON %I.protheus_modules(mod_code)',  p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_pm_sigla ON %I.protheus_modules(mod_sigla)', p_schema, p_schema);

    -- ── tenant_schemas (dicionário SX2+SX3+SIX) ──────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.tenant_schemas (
            id                  BIGSERIAL    PRIMARY KEY,
            tenant_id           VARCHAR(100) NOT NULL,
            mod_code            INTEGER      NOT NULL,
            mod_sigla           VARCHAR(30)  NOT NULL,
            chave               VARCHAR(10)  NOT NULL,  -- Ex: SE1, SA1
            tabela              VARCHAR(20),             -- Ex: SE1010
            nome                VARCHAR(120),            -- Ex: Contas a Receber
            campo               VARCHAR(15)  NOT NULL,  -- Ex: E1_NUM
            campo_titulo        VARCHAR(80),
            campo_tipo          VARCHAR(5),              -- C, N, D, L, M
            campo_tamanho       INTEGER,
            campo_decimal       INTEGER      DEFAULT 0,
            campo_obrigatorio   BOOLEAN      DEFAULT FALSE,
            campo_usado         BOOLEAN      DEFAULT TRUE,
            campo_descricao     TEXT,
            is_customizado      BOOLEAN      DEFAULT FALSE, -- campos Z ou X_
            ordem               INTEGER      DEFAULT 0,
            schema_json         JSONB,                   -- payload SX3 completo
            created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ
        )', p_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_ts_chave  ON %I.tenant_schemas(chave)',   p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_ts_campo  ON %I.tenant_schemas(campo)',   p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_ts_mod    ON %I.tenant_schemas(mod_code)',p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_ts_custom ON %I.tenant_schemas(is_customizado)', p_schema, p_schema);

    -- ── field_rules (regras específicas da empresa) ───────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.field_rules (
            id          BIGSERIAL    PRIMARY KEY,
            tenant_id   VARCHAR(100) NOT NULL,
            chave       VARCHAR(10)  NOT NULL,
            campo       VARCHAR(15)  NOT NULL,
            rule_type   VARCHAR(30)  NOT NULL, -- ''value_map'',''filter'',''alias'',''ignore''
            rule_value  TEXT,
            description TEXT,
            active      BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )', p_schema);

    -- ── query_audit (histórico de consultas) ─────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.query_audit (
            id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           VARCHAR(100) NOT NULL,
            user_id             UUID,
            prompt              TEXT,
            generated_sql       TEXT,
            execution_status    VARCHAR(20)  DEFAULT ''success'',
            rows_returned       INTEGER,
            response_time_ms    INTEGER,
            error_message       TEXT,
            tables_used         TEXT[],
            created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )', p_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_qa_user    ON %I.query_audit(user_id)',   p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_qa_created ON %I.query_audit(created_at DESC)', p_schema, p_schema);

END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- INSERT INICIAL: 54 módulos Protheus em public.protheus_modules_master
-- Execute este bloco UMA VEZ após a criação do banco
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.protheus_modules_master (mod_code, mod_sigla, mod_name) VALUES
  (1,  'SIGAATF', 'SIGAATF - Ativo Fixo'),
  (2,  'SIGAFAT', 'SIGAFAT - Faturamento'),
  (3,  'SIGACOM', 'SIGACOM - Compras / Suprimentos'),
  (4,  'SIGAEST', 'SIGAEST - Estoque e Custos'),
  (5,  'SIGAFIN', 'SIGAFIN - Financeiro'),
  (6,  'SIGAFIS', 'SIGAFIS - Livros Fiscais'),
  (7,  'SIGAGPE', 'SIGAGPE - Gestão de Pessoal'),
  (8,  'SIGAPCP', 'SIGAPCP - Planejamento e Controle da Produção'),
  (9,  'SIGAMNT', 'SIGAMNT - Manutenção de Ativos'),
  (10, 'SIGOFI',  'SIGOFI  - Oficina'),
  (11, 'SIGACRM', 'SIGACRM - Gestão de Relacionamento (CRM)'),
  (12, 'SIGAPLN', 'SIGAPLN - Planejamento e Orçamento'),
  (13, 'SIGAADV', 'SIGAADV - Administração de Vendas'),
  (14, 'SIGAPEG', 'SIGAPEG - Pecúlio e Pensões'),
  (15, 'SIGAAGR', 'SIGAAGR - Agronegócio'),
  (16, 'SIGAPON', 'SIGAPON - Ponto Eletrônico'),
  (17, 'SIGAMDT', 'SIGAMDT - Medicina e Segurança do Trabalho'),
  (18, 'SIGAQHT', 'SIGAQHT - Qualidade / Hotelaria'),
  (19, 'SIGAQMT', 'SIGAQMT - Metrologia'),
  (20, 'SIGAQDO', 'SIGAQDO - Documentação da Qualidade'),
  (21, 'SIGAQIP', 'SIGAQIP - Inspeção de Processos'),
  (22, 'SIGAQIE', 'SIGAQIE - Inspeção de Entradas'),
  (23, 'SIGAFSP', 'SIGAFSP - Fast Service / Posto de Combustível'),
  (24, 'SIGAPAT', 'SIGAPAT - Patrimônio / Ativo Fixo'),
  (25, 'SIGAVEC', 'SIGAVEC - Veículos'),
  (26, 'SIGAEC',  'SIGAEC  - Easy Construction'),
  (27, 'SIGAACD', 'SIGAACD - Automação Coleta de Dados'),
  (28, 'SIGATMS', 'SIGATMS - Gestão de Transportes (TMS)'),
  (29, 'SIGAWMS', 'SIGAWMS - Gestão de Armazém (WMS)'),
  (30, 'SIGAPMS', 'SIGAPMS - Gestão de Projetos (PMS)'),
  (31, 'SIGACDB', 'SIGACDB - Código de Barras / Automação'),
  (32, 'SIGAERM', 'SIGAERM - Risk Management'),
  (33, 'SIGAEIC', 'SIGAEIC - Easy Import Control (Importação)'),
  (34, 'SIGAEEC', 'SIGAEEC - Easy Export Control (Exportação)'),
  (35, 'SIGAEFF', 'SIGAEFF - Easy Foreign Finance'),
  (36, 'SIGAECO', 'SIGAECO - Easy Accounting / Contabilidade Câmbio'),
  (37, 'SIGAEDC', 'SIGAEDC - Easy Data Collection'),
  (38, 'SIGAEPO', 'SIGAEPO - Easy Purchase Order'),
  (39, 'SIGASFC', 'SIGASFC - Shop Floor Control (Chão de Fábrica)'),
  (40, 'SIGAPLS', 'SIGAPLS - Planos de Saúde'),
  (41, 'SIGACTL', 'SIGACTL - Controle de Locação'),
  (42, 'SIGAGVA', 'SIGAGVA - Gestão de Varejo'),
  (43, 'SIGATAC', 'SIGATAC - Gestão de Acervos / Módulos Especiais'),
  (44, 'SIGAOMS', 'SIGAOMS - Order Management System'),
  (45, 'SIGAAMB', 'SIGAAMB - Gestão Ambiental'),
  (46, 'SIGANCM', 'SIGANCM - Nomenclatura Comum do Mercosul'),
  (47, 'SIGAGCC', 'SIGAGCC - Gestão de Contratos de Concessão'),
  (48, 'SIGAGSP', 'SIGAGSP - Gestão do Setor Público'),
  (49, 'SIGAGTP', 'SIGAGTP - Gestão de Transporte de Passageiros'),
  (53, 'SIGATFP', 'SIGATFP - Gestão de Frota / Passagens'),
  (56, 'SIGAGCV', 'SIGAGCV - Gestão de Cargas e Veículos'),
  (84, 'SIGACFG', 'SIGACFG - Configurador'),
  (88, 'SIGAESP', 'SIGAESP - Específico / Customizados'),
  (97, 'SIGAFWD', 'SIGAFWD - Framework / Arquitetura')
ON CONFLICT (mod_code) DO UPDATE SET
  mod_sigla = EXCLUDED.mod_sigla,
  mod_name  = EXCLUDED.mod_name,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- COMENTÁRIOS DESCRITIVOS
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE public.protheus_modules_master IS
  'Catálogo global de módulos Protheus. Alimentado via SYS_USR_MODULE do ERP.';
COMMENT ON TABLE public.tenant_registry IS
  'Registro central de empresas contratantes. Cada registro gera um schema exclusivo no PostgreSQL.';
COMMENT ON FUNCTION public.provision_tenant_schema IS
  'Cria schema e todas as tabelas necessárias para um novo tenant. Chamada pelo backend ao cadastrar empresa.';

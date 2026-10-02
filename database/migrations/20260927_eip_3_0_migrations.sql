-- MIGRATION 001 - copilot_analyses
CREATE TABLE IF NOT EXISTS public.copilot_analyses (
    id UUID PRIMARY KEY,
    conversation_id VARCHAR NOT NULL,
    dashboard_id VARCHAR,
    source_message_id VARCHAR,
    tenant_id VARCHAR NOT NULL,
    company_id INTEGER,
    environment_code VARCHAR,
    domain_code VARCHAR,
    module_code INTEGER,
    module_sigla VARCHAR,
    intent_code VARCHAR,
    dataset_type VARCHAR,
    schema_json JSONB,
    metrics_json JSONB,
    insights_json JSONB,
    validation_json JSONB,
    presentation_json JSONB,
    quality_score NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_conversation ON public.copilot_analyses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_analysis_dashboard ON public.copilot_analyses(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_analysis_domain ON public.copilot_analyses(domain_code);
CREATE INDEX IF NOT EXISTS idx_analysis_module ON public.copilot_analyses(module_code);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON public.copilot_analyses(created_at);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='copilot_analyses' AND constraint_name='fk_analysis_conversation') THEN
        ALTER TABLE public.copilot_analyses ADD CONSTRAINT fk_analysis_conversation FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='copilot_analyses' AND constraint_name='fk_analysis_dashboard') THEN
        ALTER TABLE public.copilot_analyses ADD CONSTRAINT fk_analysis_dashboard FOREIGN KEY (dashboard_id) REFERENCES public.copilot_dashboards(id);
    END IF;
END $$;

-- MIGRATION 002 - insight_rules
CREATE TABLE IF NOT EXISTS public.insight_rules (
    id UUID PRIMARY KEY,
    domain_code VARCHAR NOT NULL,
    rule_code VARCHAR NOT NULL,
    rule_name VARCHAR NOT NULL,
    severity VARCHAR NOT NULL,
    priority INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    rule_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insight_rule_code ON public.insight_rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_insight_domain ON public.insight_rules(domain_code);
CREATE INDEX IF NOT EXISTS idx_insight_active ON public.insight_rules(active);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='insight_rules' AND constraint_name='fk_insight_domain') THEN
        ALTER TABLE public.insight_rules ADD CONSTRAINT fk_insight_domain FOREIGN KEY(domain_code) REFERENCES public.business_domains(domain_code);
    END IF;
END $$;

-- MIGRATION 003 - presentation_rules
CREATE TABLE IF NOT EXISTS public.presentation_rules (
    id UUID PRIMARY KEY,
    dataset_type VARCHAR NOT NULL,
    rule_code VARCHAR NOT NULL,
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    rule_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_presentation_rule ON public.presentation_rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_presentation_dataset ON public.presentation_rules(dataset_type);

-- MIGRATION 004 - semantic_dictionary
CREATE TABLE IF NOT EXISTS public.semantic_dictionary (
    id UUID PRIMARY KEY,
    table_name VARCHAR NOT NULL,
    field_name VARCHAR NOT NULL,
    business_name VARCHAR NOT NULL,
    description TEXT,
    display_format VARCHAR,
    semantic_type VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_semantic_field ON public.semantic_dictionary(table_name, field_name);
CREATE INDEX IF NOT EXISTS idx_semantic_type ON public.semantic_dictionary(semantic_type);

-- MIGRATION 005 - Evolução TES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_rule_tes' AND column_name='affects_gross_revenue') THEN
        ALTER TABLE public.business_rule_tes ADD COLUMN affects_gross_revenue BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_rule_tes' AND column_name='affects_net_revenue') THEN
        ALTER TABLE public.business_rule_tes ADD COLUMN affects_net_revenue BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_rule_tes' AND column_name='affects_abc') THEN
        ALTER TABLE public.business_rule_tes ADD COLUMN affects_abc BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_rule_tes' AND column_name='affects_dashboard') THEN
        ALTER TABLE public.business_rule_tes ADD COLUMN affects_dashboard BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_rule_tes' AND column_name='revenue_effect') THEN
        ALTER TABLE public.business_rule_tes ADD COLUMN revenue_effect VARCHAR(20) DEFAULT 'ADD';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_tes_classification ON public.business_rule_tes(classification);
CREATE INDEX IF NOT EXISTS idx_business_tes_direction ON public.business_rule_tes(direction);
CREATE INDEX IF NOT EXISTS idx_business_tes_active ON public.business_rule_tes(active);

-- MIGRATION 006 - Evolução CFOP
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cfop_rules' AND column_name='operation_type') THEN
        ALTER TABLE public.business_cfop_rules ADD COLUMN operation_type VARCHAR;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cfop_rules' AND column_name='affects_revenue') THEN
        ALTER TABLE public.business_cfop_rules ADD COLUMN affects_revenue BOOLEAN;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cfop_rules' AND column_name='affects_inventory') THEN
        ALTER TABLE public.business_cfop_rules ADD COLUMN affects_inventory BOOLEAN;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cfop_rules' AND column_name='affects_tax') THEN
        ALTER TABLE public.business_cfop_rules ADD COLUMN affects_tax BOOLEAN;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cfop_operation_type ON public.business_cfop_rules(operation_type);

-- MIGRATION 007 - Evolução Naturezas Financeiras
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_financial_natures' AND column_name='cashflow_type') THEN
        ALTER TABLE public.business_financial_natures ADD COLUMN cashflow_type VARCHAR(30);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_financial_natures' AND column_name='affects_result') THEN
        ALTER TABLE public.business_financial_natures ADD COLUMN affects_result BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financial_cashflow ON public.business_financial_natures(cashflow_type);
CREATE INDEX IF NOT EXISTS idx_financial_group ON public.business_financial_natures(financial_group);

-- MIGRATION 008 - Receivable Config
CREATE TABLE IF NOT EXISTS public.business_receivable_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    overdue_days INTEGER DEFAULT 30,
    include_renegotiated BOOLEAN DEFAULT FALSE,
    include_provisional BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_receivable_tenant ON public.business_receivable_configs(tenant_id);

-- MIGRATION 009 - Revenue Config
CREATE TABLE IF NOT EXISTS public.business_revenue_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    included_classifications JSONB,
    excluded_classifications JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_revenue_tenant ON public.business_revenue_configs(tenant_id);

-- MIGRATION 010 - Inventory Config
CREATE TABLE IF NOT EXISTS public.business_inventory_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    stock_idle_days INTEGER,
    stock_critical_days INTEGER,
    stock_rupture_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_tenant ON public.business_inventory_configs(tenant_id);

-- MIGRATION 011 - ABC Config
CREATE TABLE IF NOT EXISTS public.business_abc_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    class_a_pct NUMERIC(8,2),
    class_b_pct NUMERIC(8,2),
    class_c_pct NUMERIC(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='business_abc_configs' AND constraint_name='chk_abc_total') THEN
        ALTER TABLE public.business_abc_configs ADD CONSTRAINT chk_abc_total CHECK (class_a_pct + class_b_pct + class_c_pct = 100);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_abc_tenant ON public.business_abc_configs(tenant_id);

-- MIGRATION 012 - Integridade Referencial Existente (business_intents)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='business_intents' AND constraint_name='fk_business_intent_domain') THEN
        ALTER TABLE public.business_intents ADD CONSTRAINT fk_business_intent_domain FOREIGN KEY(domain_code) REFERENCES public.business_domains(domain_code);
    END IF;
END $$;

-- MIGRATION 013 - business_intent_tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='business_intent_tables' AND constraint_name='fk_business_intent_tables') THEN
        ALTER TABLE public.business_intent_tables ADD CONSTRAINT fk_business_intent_tables FOREIGN KEY(intent_id) REFERENCES public.business_intents(id);
    END IF;
END $$;

-- MIGRATION 014 - business_dashboard_templates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='business_dashboard_templates' AND constraint_name='fk_dashboard_template_intent') THEN
        ALTER TABLE public.business_dashboard_templates ADD CONSTRAINT fk_dashboard_template_intent FOREIGN KEY(intent_id) REFERENCES public.business_intents(id);
    END IF;
END $$;

-- MIGRATION 015 - tenant_module_contracts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_module_contracts' AND column_name='snapshot_id') THEN
        ALTER TABLE public.tenant_module_contracts ADD COLUMN snapshot_id UUID;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='tenant_module_contracts' AND constraint_name='fk_module_contract') THEN
        ALTER TABLE public.tenant_module_contracts ADD CONSTRAINT fk_module_contract FOREIGN KEY(contract_id) REFERENCES public.tenant_contracts(id);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='tenant_module_contracts' AND constraint_name='fk_module_reference') THEN
        ALTER TABLE public.tenant_module_contracts ADD CONSTRAINT fk_module_reference FOREIGN KEY(module_id) REFERENCES public.protheus_modules_master(id);
    END IF;
END $$;

-- MIGRATION 016 - RBAC
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='role_permissions' AND constraint_name='fk_role_permission_role') THEN
        ALTER TABLE public.role_permissions ADD CONSTRAINT fk_role_permission_role FOREIGN KEY(role_id) REFERENCES public.roles(id);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='role_permissions' AND constraint_name='fk_role_permission_perm') THEN
        ALTER TABLE public.role_permissions ADD CONSTRAINT fk_role_permission_perm FOREIGN KEY(permission_id) REFERENCES public.permissions(id);
    END IF;
END $$;

-- MIGRATION 017 - user_company_access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='user_company_access' AND constraint_name='fk_user_company_user') THEN
        ALTER TABLE public.user_company_access ADD CONSTRAINT fk_user_company_user FOREIGN KEY(user_id) REFERENCES public.users(id);
    END IF;
END $$;

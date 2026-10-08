BEGIN;

CREATE TABLE public.schema_versions (
  version varchar(32) PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code varchar(64) NOT NULL UNIQUE,
  tenant_name varchar(200) NOT NULL,
  schema_name varchar(63) NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','DECOMMISSIONED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provisioned_at timestamptz,
  CONSTRAINT chk_tenant_schema_name CHECK (
    schema_name ~ '^[a-z][a-z0-9_]{2,62}$'
    AND schema_name NOT IN ('public','information_schema','pg_catalog')
    AND schema_name NOT LIKE 'pg_%'
  )
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code varchar(64) NOT NULL UNIQUE,
  role_name varchar(160) NOT NULL,
  scope_level varchar(24) NOT NULL
    CHECK (scope_level IN ('PLATFORM','TENANT','COMPANY')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code varchar(120) NOT NULL UNIQUE,
  permission_name varchar(200) NOT NULL,
  resource varchar(120) NOT NULL,
  action varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id),
  email varchar(320) NOT NULL,
  full_name varchar(200),
  password_hash text,
  external_subject varchar(255),
  status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED','ACTIVE','BLOCKED','DISABLED')),
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(64) NOT NULL UNIQUE,
  plan_name varchar(160) NOT NULL,
  query_limit integer CHECK (query_limit IS NULL OR query_limit >= 0),
  concurrent_sessions_limit integer
    CHECK (concurrent_sessions_limit IS NULL OR concurrent_sessions_limit >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  contract_code varchar(100) NOT NULL UNIQUE,
  status varchar(24) NOT NULL
    CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','CANCELED')),
  starts_at date,
  ends_at date,
  query_limit_override integer,
  concurrent_sessions_override integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE public.protheus_modules_master (
  id integer PRIMARY KEY,
  module_sigla varchar(32) NOT NULL,
  description varchar(200) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_module_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.tenant_contracts(id) ON DELETE CASCADE,
  module_id integer NOT NULL REFERENCES public.protheus_modules_master(id),
  status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, module_id)
);

CREATE TABLE public.business_domains (
  domain_code varchar(64) PRIMARY KEY,
  name varchar(160) NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_domain_modules (
  domain_code varchar(64) NOT NULL
    REFERENCES public.business_domains(domain_code) ON DELETE CASCADE,
  module_id integer NOT NULL
    REFERENCES public.protheus_modules_master(id),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain_code, module_id)
);
CREATE UNIQUE INDEX uq_business_domain_primary
  ON public.business_domain_modules(domain_code)
  WHERE is_primary;

CREATE TABLE public.business_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_code varchar(64) NOT NULL
    REFERENCES public.business_domains(domain_code),
  intent_code varchar(100) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_intent_tables (
  intent_id uuid NOT NULL REFERENCES public.business_intents(id) ON DELETE CASCADE,
  table_code varchar(64) NOT NULL,
  required boolean NOT NULL DEFAULT false,
  priority_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (intent_id, table_code)
);

CREATE TABLE public.metric_definitions (
  metric_code varchar(100) PRIMARY KEY,
  domain_code varchar(64) REFERENCES public.business_domains(domain_code),
  name varchar(160) NOT NULL,
  deterministic_handler varchar(255) NOT NULL,
  result_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.insight_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_code varchar(64) REFERENCES public.business_domains(domain_code),
  rule_code varchar(100) NOT NULL UNIQUE,
  rule_name varchar(160) NOT NULL,
  severity varchar(24) NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  rule_json jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.presentation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_type varchar(64) NOT NULL,
  rule_code varchar(100) NOT NULL UNIQUE,
  priority integer NOT NULL DEFAULT 0,
  rule_json jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  target_type varchar(120),
  target_id varchar(255),
  trace_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.query_usage_counters (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_ref varchar(16) NOT NULL,
  total_queries bigint NOT NULL DEFAULT 0 CHECK (total_queries >= 0),
  blocked_queries bigint NOT NULL DEFAULT 0 CHECK (blocked_queries >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, period_ref)
);

CREATE INDEX idx_users_tenant_status ON public.users(tenant_id, status);
CREATE INDEX idx_contracts_tenant_status ON public.tenant_contracts(tenant_id, status);
CREATE INDEX idx_module_contracts_tenant_status ON public.tenant_module_contracts(tenant_id, status);
CREATE INDEX idx_intents_domain_active ON public.business_intents(domain_code, active);
CREATE INDEX idx_platform_audit_tenant_created ON public.platform_audit_log(tenant_id, created_at DESC);

INSERT INTO public.schema_versions(version, description)
VALUES ('2.0.0', 'Clean control plane and tenant data plane');

COMMIT;

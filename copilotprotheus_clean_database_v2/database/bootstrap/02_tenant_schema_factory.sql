BEGIN;

CREATE OR REPLACE FUNCTION public.quote_tenant_schema(p_schema_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $fn$
BEGIN
  IF p_schema_name !~ '^[a-z][a-z0-9_]{2,62}$'
     OR p_schema_name IN ('public','information_schema','pg_catalog')
     OR p_schema_name LIKE 'pg_%' THEN
    RAISE EXCEPTION 'schema_name inválido ou reservado: %', p_schema_name;
  END IF;
  RETURN quote_ident(p_schema_name);
END
$fn$;

CREATE OR REPLACE FUNCTION public.provision_tenant_schema(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_schema text;
BEGIN
  SELECT schema_name INTO v_schema
    FROM public.tenants
   WHERE id=p_tenant_id
     AND status IN ('PENDING','ACTIVE')
   FOR UPDATE;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Tenant inexistente ou indisponível: %', p_tenant_id;
  END IF;

  PERFORM public.quote_tenant_schema(v_schema);
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_code varchar(32) NOT NULL,
      branch_code varchar(32) NOT NULL,
      legal_name varchar(200) NOT NULL,
      display_name varchar(160),
      tax_id varchar(32),
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(company_code, branch_code)
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.environments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      environment_code varchar(64) NOT NULL UNIQUE,
      environment_name varchar(160) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.protheus_connections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      environment_id uuid NOT NULL REFERENCES %I.environments(id) ON DELETE CASCADE,
      base_rest_url text NOT NULL,
      auth_mode varchar(24) NOT NULL,
      secret_ref text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      last_auth_status integer,
      last_auth_error text,
      last_success_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(environment_id)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.user_company_access (
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      company_id uuid NOT NULL REFERENCES %I.companies(id) ON DELETE CASCADE,
      environment_id uuid NOT NULL REFERENCES %I.environments(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id, company_id, environment_id)
    )
  $ddl$, v_schema, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.tenant_modules (
      module_id integer PRIMARY KEY REFERENCES public.protheus_modules_master(id),
      enabled boolean NOT NULL DEFAULT true,
      provisioned_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema);

  EXECUTE format(
    'INSERT INTO %I.tenant_modules(module_id) '
    'SELECT DISTINCT tmc.module_id FROM public.tenant_module_contracts tmc '
    'WHERE tmc.tenant_id=$1 AND tmc.status=''ACTIVE'' '
    'ON CONFLICT(module_id) DO NOTHING',
    v_schema
  ) USING p_tenant_id;

  EXECUTE format($ddl$
    CREATE TABLE %I.business_rule_sets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_code varchar(100) NOT NULL UNIQUE,
      name varchar(160) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'DRAFT',
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      valid_from timestamptz,
      valid_to timestamptz,
      created_by uuid REFERENCES public.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_rule_tes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id uuid NOT NULL REFERENCES %I.business_rule_sets(id) ON DELETE CASCADE,
      tes_code varchar(16) NOT NULL,
      direction varchar(16) NOT NULL CHECK(direction IN ('INBOUND','OUTBOUND')),
      classification_code varchar(64) NOT NULL,
      affects_gross_revenue boolean NOT NULL DEFAULT false,
      affects_net_revenue boolean NOT NULL DEFAULT false,
      affects_abc boolean NOT NULL DEFAULT false,
      revenue_effect varchar(16) NOT NULL DEFAULT 'IGNORE'
        CHECK(revenue_effect IN ('ADD','SUBTRACT','IGNORE')),
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(rule_set_id, tes_code, direction)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_cfop_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id uuid NOT NULL REFERENCES %I.business_rule_sets(id) ON DELETE CASCADE,
      cfop_code varchar(16) NOT NULL,
      classification_code varchar(64) NOT NULL,
      operation_type varchar(32),
      affects_revenue boolean NOT NULL DEFAULT false,
      affects_inventory boolean NOT NULL DEFAULT false,
      affects_tax boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(rule_set_id, cfop_code)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_financial_natures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id uuid NOT NULL REFERENCES %I.business_rule_sets(id) ON DELETE CASCADE,
      nature_code varchar(64) NOT NULL,
      nature_name varchar(200),
      financial_group varchar(64) NOT NULL,
      cashflow_type varchar(32),
      affects_result boolean NOT NULL DEFAULT true,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(rule_set_id, nature_code)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_revenue_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES %I.companies(id) ON DELETE CASCADE,
      included_classifications jsonb NOT NULL DEFAULT '[]'::jsonb,
      excluded_classifications jsonb NOT NULL DEFAULT '[]'::jsonb,
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES public.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE NULLS NOT DISTINCT(company_id, version)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_receivable_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES %I.companies(id) ON DELETE CASCADE,
      overdue_days integer NOT NULL DEFAULT 30 CHECK(overdue_days >= 0),
      include_renegotiated boolean NOT NULL DEFAULT false,
      include_provisional boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES public.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE NULLS NOT DISTINCT(company_id, version)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_inventory_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES %I.companies(id) ON DELETE CASCADE,
      stock_idle_days integer CHECK(stock_idle_days IS NULL OR stock_idle_days >= 0),
      stock_critical_days integer CHECK(stock_critical_days IS NULL OR stock_critical_days >= 0),
      stock_rupture_days integer CHECK(stock_rupture_days IS NULL OR stock_rupture_days >= 0),
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES public.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE NULLS NOT DISTINCT(company_id, version)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_abc_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES %I.companies(id) ON DELETE CASCADE,
      class_a_pct numeric(8,4) NOT NULL,
      class_b_pct numeric(8,4) NOT NULL,
      class_c_pct numeric(8,4) NOT NULL,
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES public.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK(class_a_pct >= 0 AND class_b_pct >= 0 AND class_c_pct >= 0),
      CHECK(class_a_pct + class_b_pct + class_c_pct = 100),
      UNIQUE NULLS NOT DISTINCT(company_id, version)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.business_synonyms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_term varchar(200) NOT NULL,
      target_term varchar(200) NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(source_term)
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.dictionary_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      environment_id uuid NOT NULL REFERENCES %I.environments(id),
      module_id integer NOT NULL REFERENCES %I.tenant_modules(module_id),
      snapshot_code varchar(100) NOT NULL UNIQUE,
      status varchar(24) NOT NULL,
      checksum varchar(128),
      created_at timestamptz NOT NULL DEFAULT now(),
      activated_at timestamptz
    )
  $ddl$, v_schema, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.dictionary_tables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_id uuid NOT NULL REFERENCES %I.dictionary_snapshots(id) ON DELETE CASCADE,
      table_code varchar(32) NOT NULL,
      table_name varchar(200),
      physical_name varchar(200) NOT NULL,
      business_name varchar(200),
      description text,
      active boolean NOT NULL DEFAULT true,
      UNIQUE(snapshot_id, table_code)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.dictionary_fields (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id uuid NOT NULL REFERENCES %I.dictionary_tables(id) ON DELETE CASCADE,
      field_name varchar(100) NOT NULL,
      business_name varchar(200),
      description text,
      field_type varchar(64),
      display_format varchar(64),
      semantic_type varchar(64),
      required_flag boolean NOT NULL DEFAULT false,
      virtual_flag boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      UNIQUE(table_id, field_name)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      visibility varchar(32) NOT NULL,
      title varchar(300) NOT NULL,
      source_ref text NOT NULL,
      source_type varchar(64),
      module_id integer REFERENCES public.protheus_modules_master(id),
      category varchar(100),
      version varchar(64),
      status varchar(24) NOT NULL DEFAULT 'ACTIVE',
      checksum varchar(128),
      language varchar(16),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.document_chunks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      chunk_order integer NOT NULL CHECK(chunk_order >= 0),
      content text NOT NULL,
      token_count integer CHECK(token_count IS NULL OR token_count >= 0),
      embedding_model varchar(120),
      embedding vector,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(document_id, chunk_order)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.memories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES %I.companies(id) ON DELETE CASCADE,
      visibility varchar(32) NOT NULL,
      memory_key varchar(200) NOT NULL,
      memory_value text NOT NULL,
      memory_type varchar(64),
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      confidence numeric(5,4),
      source varchar(200),
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(company_id, memory_key)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id),
      title varchar(300),
      status varchar(24) NOT NULL DEFAULT 'ACTIVE'
        CHECK(status IN ('ACTIVE','ARCHIVED','DELETED')),
      is_favorite boolean NOT NULL DEFAULT false,
      context_state jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES %I.copilot_conversations(id) ON DELETE CASCADE,
      role varchar(16) NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content text NOT NULL,
      client_message_id uuid,
      analysis_id uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(conversation_id, client_message_id)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_analyses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES %I.copilot_conversations(id) ON DELETE CASCADE,
      source_message_id uuid NOT NULL REFERENCES %I.copilot_messages(id),
      assistant_message_id uuid REFERENCES %I.copilot_messages(id),
      company_id uuid REFERENCES %I.companies(id),
      environment_id uuid REFERENCES %I.environments(id),
      domain_code varchar(64) REFERENCES public.business_domains(domain_code),
      module_id integer REFERENCES public.protheus_modules_master(id),
      intent_id uuid REFERENCES public.business_intents(id),
      intent_confidence numeric(8,6),
      dataset_type varchar(64),
      row_count integer CHECK(row_count IS NULL OR row_count >= 0),
      schema_json jsonb,
      metrics_json jsonb,
      validation_json jsonb NOT NULL,
      insights_json jsonb,
      presentation_json jsonb,
      quality_score numeric(8,4),
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      status varchar(24) NOT NULL DEFAULT 'COMPLETED',
      trace_id uuid NOT NULL DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema);

  EXECUTE format(
    'ALTER TABLE %I.copilot_messages ADD CONSTRAINT fk_message_analysis '
    'FOREIGN KEY (analysis_id) REFERENCES %I.copilot_analyses(id) ON DELETE SET NULL',
    v_schema, v_schema
  );

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_dashboards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES %I.copilot_conversations(id) ON DELETE CASCADE,
      analysis_id uuid NOT NULL REFERENCES %I.copilot_analyses(id) ON DELETE RESTRICT,
      title varchar(300) NOT NULL,
      dashboard_type varchar(64),
      config_json jsonb NOT NULL,
      is_favorite boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(analysis_id)
    )
  $ddl$, v_schema, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      active_conversation_id uuid REFERENCES %I.copilot_conversations(id) ON DELETE SET NULL,
      last_activity timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id)
    )
  $ddl$, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_favorites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      item_type varchar(32) NOT NULL,
      item_id uuid NOT NULL,
      title varchar(300),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, item_type, item_id)
    )
  $ddl$, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.copilot_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      conversation_id uuid REFERENCES %I.copilot_conversations(id) ON DELETE SET NULL,
      message_id uuid REFERENCES %I.copilot_messages(id) ON DELETE SET NULL,
      analysis_id uuid REFERENCES %I.copilot_analyses(id) ON DELETE SET NULL,
      event_type varchar(100) NOT NULL,
      event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      trace_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema, v_schema, v_schema, v_schema);

  EXECUTE format($ddl$
    CREATE TABLE %I.agent_query_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      company_id uuid REFERENCES %I.companies(id) ON DELETE SET NULL,
      environment_id uuid REFERENCES %I.environments(id) ON DELETE SET NULL,
      conversation_id uuid REFERENCES %I.copilot_conversations(id) ON DELETE SET NULL,
      analysis_id uuid REFERENCES %I.copilot_analyses(id) ON DELETE SET NULL,
      request_id uuid,
      sql_hash varchar(128),
      execution_status varchar(32) NOT NULL,
      rows_returned integer,
      response_time_ms integer,
      blocked_reason text,
      tables_used jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  $ddl$, v_schema, v_schema, v_schema, v_schema, v_schema);

  EXECUTE format('CREATE INDEX idx_%s_messages_conversation_created ON %I.copilot_messages(conversation_id, created_at)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_messages_analysis ON %I.copilot_messages(analysis_id)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_analyses_conversation_created ON %I.copilot_analyses(conversation_id, created_at)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_dashboards_conversation ON %I.copilot_dashboards(conversation_id)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_events_trace ON %I.copilot_events(trace_id)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_query_audit_created ON %I.agent_query_audit(created_at)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_dictionary_tables_snapshot ON %I.dictionary_tables(snapshot_id)', v_schema, v_schema);
  EXECUTE format('CREATE INDEX idx_%s_dictionary_fields_table ON %I.dictionary_fields(table_id)', v_schema, v_schema);

  UPDATE public.tenants
     SET status='ACTIVE', provisioned_at=now(), updated_at=now()
   WHERE id=p_tenant_id;

  RETURN v_schema;
END
$fn$;

REVOKE ALL ON FUNCTION public.quote_tenant_schema(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_tenant_schema(uuid) FROM PUBLIC;

COMMIT;

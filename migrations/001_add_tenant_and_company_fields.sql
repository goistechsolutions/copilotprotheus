ALTER TABLE public.tenant
ADD COLUMN IF NOT EXISTS frontend_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS api_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_table_permissions') THEN
    CREATE TABLE public.tenant_table_permissions (
      id BIGSERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      schema_name VARCHAR(100) NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      can_list BOOLEAN DEFAULT FALSE,
      can_describe BOOLEAN DEFAULT FALSE,
      can_query BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_field_permissions') THEN
    CREATE TABLE public.tenant_field_permissions (
      id BIGSERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL,
      schema_name VARCHAR(100) NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      field_name VARCHAR(100) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      can_select BOOLEAN DEFAULT FALSE,
      can_filter BOOLEAN DEFAULT FALSE,
      masked_flag BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END $$;

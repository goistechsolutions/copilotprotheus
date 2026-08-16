CREATE TABLE IF NOT EXISTS public.tenant_dictionary_sources (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  schema_name VARCHAR(100) NOT NULL,
  source_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  last_sync_at TIMESTAMP NULL,
  next_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

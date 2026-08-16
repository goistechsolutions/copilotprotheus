DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name FROM public.tenant WHERE schema_name IS NOT NULL
    LOOP
        EXECUTE format('
            ALTER TABLE "%I".company_info
            ADD COLUMN IF NOT EXISTS frontend_domain VARCHAR(255),
            ADD COLUMN IF NOT EXISTS api_domain VARCHAR(255),
            ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS default_flag BOOLEAN DEFAULT FALSE;
        ', schema_record.schema_name);
    END LOOP;
END $$;

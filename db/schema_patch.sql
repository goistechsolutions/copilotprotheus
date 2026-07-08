-- db/schema_patch.sql  -- Executar no PostgreSQL
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS intent            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS response_time_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS records_returned  INTEGER;

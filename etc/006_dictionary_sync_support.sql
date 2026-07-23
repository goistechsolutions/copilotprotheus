BEGIN;

CREATE OR REPLACE VIEW vw_tenant_dictionary_overview AS
SELECT
    ds.tenant_id,
    ds.company_id,
    ds.env_id,
    ds.snapshot_code,
    ds.started_at,
    dt.module_code,
    dt.table_key,
    dt.physical_name,
    dt.table_name,
    dt.usa_empresa,
    dt.usa_unidade,
    dt.usa_filial,
    COUNT(DISTINCT df.id) AS total_fields,
    COUNT(DISTINCT di.id) AS total_indexes
FROM dictionary_snapshots ds
JOIN tenant_dictionary_tables dt ON dt.snapshot_id = ds.id
LEFT JOIN tenant_dictionary_fields df ON df.table_id = dt.id
LEFT JOIN tenant_dictionary_indexes di ON di.table_id = dt.id
GROUP BY
    ds.tenant_id,
    ds.company_id,
    ds.env_id,
    ds.snapshot_code,
    ds.started_at,
    dt.module_code,
    dt.table_key,
    dt.physical_name,
    dt.table_name,
    dt.usa_empresa,
    dt.usa_unidade,
    dt.usa_filial;

COMMIT;

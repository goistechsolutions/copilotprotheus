from app.services.protheus_module_catalog import (
    filter_allowed_dictionary_tables,
    load_dictionary_fields,
)


class _MappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return list(self._rows)


class _DictionaryDB:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, dict(params or {})))
        if "information_schema.columns" in sql:
            return _MappingsResult([
                {"column_name": "id"},
                {"column_name": "tenant_id"},
                {"column_name": "table_code"},
                {"column_name": "table_name"},
                {"column_name": "field_name"},
                {"column_name": "title"},
                {"column_name": "environment_id"},
            ])
        return _MappingsResult([
            {"field_name": "F1_VALBRUT", "field_label": "Valor bruto"},
        ])


def test_load_dictionary_fields_prioritizes_sx2_key_and_limits_legacy_fallback():
    db = _DictionaryDB()

    fields = load_dictionary_fields(
        db=db,
        tenant_schema="tenant_fixture",
        table_code="SF1",
        table_name="SF1010",
        environment_id="env_fixture",
    )

    query, params = db.calls[-1]
    assert fields[0]["field_name"] == "F1_VALBRUT"
    assert "df.table_code = :table_code" in query
    assert "NULLIF(BTRIM(COALESCE(df.table_code, '')), '') IS NULL" not in query
    assert "df.table_name IN (:table_code, :table_name)" not in query
    assert "df.tenant_id = :tenant_id" in query
    assert params == {
        "tenant_id": "tenant_fixture",
        "table_code": "SF1",
        "table_name": "SF1010",
        "environment_id": "env_fixture",
    }


class _TablesDB:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, dict(params or {})))
        if "information_schema.columns" in sql:
            return _MappingsResult([
                {"column_name": "tenant_id"},
                {"column_name": "table_code"},
                {"column_name": "table_name"},
                {"column_name": "module_code"},
                {"column_name": "description"},
                {"column_name": "active_flag"},
                {"column_name": "environment_id"},
            ])
        return _MappingsResult([{
            "table_code": "SF1",
            "table_name": "SF1010",
            "module_code": "2",
            "description": "Notas de entrada",
        }])


def test_dictionary_tables_is_the_direct_imported_catalog_scope():
    db = _TablesDB()

    tables = filter_allowed_dictionary_tables(
        db=db,
        tenant_schema="tenant_fixture",
        module_codes=["2"],
        environment_id="env_fixture",
    )

    query, params = db.calls[-1]
    assert tables[0]["table_code"] == "SF1"
    assert 'FROM "tenant_fixture".dictionary_tables dt' in query
    assert "tenant_schemas" not in query
    assert "COALESCE(dt.active_flag, TRUE) = TRUE" in query
    assert "dt.tenant_id = :tenant_id" in query
    assert params == {
        "tenant_id": "tenant_fixture",
        "module_codes": ["2"],
        "environment_id": "env_fixture",
    }

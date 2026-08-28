from app.services.protheus_module_catalog import load_dictionary_fields


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
    assert "df.table_code" in query
    assert "NULLIF(BTRIM(COALESCE(df.table_code, '')), '') IS NULL" in query
    assert "df.table_name IN (:table_code, :table_name)" in query
    assert params == {
        "table_code": "SF1",
        "table_name": "SF1010",
        "environment_id": "env_fixture",
    }

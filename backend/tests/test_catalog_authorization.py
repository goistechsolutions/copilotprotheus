from app.services.entitlement_guard import EntitlementGuard


class _Result:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self

    def all(self):
        return list(self.rows)


class _CatalogDB:
    def __init__(self, field_rows=None):
        self.field_rows = field_rows or []
        self.queries = []

    def execute(self, query, params=None):
        sql = str(query)
        self.queries.append(sql)
        if "tenant_field_permissions" in sql:
            return _Result(self.field_rows)
        raise AssertionError(f"consulta inesperada no fake: {sql}")


def test_imported_catalog_authorizes_tables_and_fields_without_table_permissions():
    db = _CatalogDB()
    guard = EntitlementGuard(mode="enforce")

    authorization = guard.authorize_dictionary_details(
        db,
        tenant_schema="rodol_prod",
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        company_id=1,
        role_id=None,
        table_names=["SF1"],
        catalog_fields_by_table={"SF1": ["F1_DOC", "F1_TOTAL"]},
    )

    assert "SF1" in authorization.allowed_tables
    assert authorization.allowed_fields_by_table["SF1"] == {"F1_DOC", "F1_TOTAL"}
    assert not any("tenant_table_permissions" in query for query in db.queries)


def test_optional_field_permission_can_restrict_catalog_field(monkeypatch):
    db = _CatalogDB(
        field_rows=[
            {
                "table_name": "SF1",
                "field_name": "F1_TOTAL",
                "can_select": False,
                "can_filter": False,
                "masked_flag": False,
            }
        ]
    )
    guard = EntitlementGuard(mode="enforce")
    monkeypatch.setattr(
        guard,
        "_schema_table_exists",
        lambda _db, _schema, table: table == "tenant_field_permissions",
    )

    authorization = guard.authorize_dictionary_details(
        db,
        tenant_schema="rodol_prod",
        tenant_code="rodol_prod",
        environment_code="c8te0u_prod",
        company_id=1,
        role_id="admin",
        table_names=["SF1"],
        catalog_fields_by_table={"SF1": ["F1_DOC", "F1_TOTAL"]},
    )

    assert authorization.allowed_tables == {"SF1", "SF1010"}
    assert authorization.allowed_fields_by_table["SF1"] == {"F1_DOC"}
    assert authorization.allowed_fields_by_table["SF1010"] == {"F1_DOC"}

from app.api.business_rules_routes import BUSINESS_RULES_METADATA, get_business_rules_metadata, router


def test_business_rules_metadata_route_is_registered():
    paths = [route.path for route in router.routes]
    assert "/admin/business-rules/metadata" in paths


def test_business_rules_metadata_exposes_canonical_options_and_defaults():
    metadata = get_business_rules_metadata(admin={"sub": "admin"})

    assert metadata["version"] == 1
    assert metadata["classifications"]["tes"]
    assert metadata["classifications"]["cfop"]
    assert metadata["financialGroups"]
    assert metadata["cashFlowTables"] == metadata["defaults"]["ai_cash_flow_tables"]

    tes_values = {item["value"] for item in metadata["classifications"]["tes"]}
    assert set(metadata["defaults"]["billing_included_classifications"]).issubset(tes_values)
    assert set(metadata["defaults"]["billing_excluded_classifications"]).issubset(tes_values)

    for item in metadata["classifications"]["tes"]:
        assert item["value"]
        assert item["label"]
        assert item["directions"]


def test_business_rules_metadata_handler_returns_the_single_source_object():
    assert get_business_rules_metadata(admin=None) is BUSINESS_RULES_METADATA

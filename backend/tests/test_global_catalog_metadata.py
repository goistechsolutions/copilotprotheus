from app.api.admin_routes import _build_global_catalog_metadata


def test_global_catalog_metadata_contains_structure_only():
    catalog = _build_global_catalog_metadata({
        "SF1": {
            "x2_modulo": "2",
            "tabela": "SF1010",
            "nome": "Notas de entrada",
            "compartilhamento": {
                "empresa": "E",
                "unidade": "N",
                "filial": "E",
            },
            "indice_principal": "F1_FILIAL+F1_DOC",
            "campos": [{
                "campo": "F1_DOC",
                "descricao": "Documento",
                "tipo": "C",
                "tamanho": 9,
            }],
            "tenant_id": "must-not-be-copied",
            "records": [{"F1_DOC": "must-not-be-copied"}],
        }
    })

    assert catalog == {
        "2": {
            "schema_version": "sx2-sx3-v1",
            "source": "SX2/SX3",
            "tables": [{
                "table_code": "SF1",
                "physical_name": "SF1010",
                "description": "Notas de entrada",
                "sharing": {
                    "empresa": "E",
                    "unidade": "N",
                    "filial": "E",
                },
                "unique_index": "F1_FILIAL+F1_DOC",
                "fields": [{
                    "field_name": "F1_DOC",
                    "title": "Documento",
                    "field_type": "C",
                    "length_num": 9,
                }],
            }],
        }
    }

    rendered = str(catalog)
    assert "must-not-be-copied" not in rendered

import re

with open('backend/tests/test_company_crud_contract.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace company_rows with the new schema in test_list_companies_keeps_real_company_info_id
old_company_rows = """            {
                "id": 42,
                "tenant_id": "tenant_fixture",
                "cnpj": "",
                "ie": None,
                "razao_social": "Empresa Fixture",
                "email": None,
                "telefone": None,
                "endereco": None,
                "protheus_grupo": "tenant_fixture",
                "protheus_empresa": "01",
                "protheus_unidade": "01",
                "protheus_filial": "0101",
                "protheus_ambientes": "c8te0u_prod",
                "protheus_usuario": None,
                "protheus_rest_url": None,
                "webapp_url": None,
                "status": "ativa",
                "created_at": None,
                "updated_at": None,
            }"""

new_company_rows = """            {
                "id": 42,
                "company_code": "01",
                "branch_code": "0101",
                "legal_name": "Empresa Fixture",
                "tax_id": "",
                "status": "ACTIVE"
            }"""

content = content.replace(old_company_rows, new_company_rows)

# Replace "mod_sigla" and "mod_code" in test_replace_company_modules_refreshes_active_contract_scope and test_replace_company_modules_rejects_module_outside_global_catalog
content = content.replace(
    '{"module_id": 5, "mod_code": 5, "mod_sigla": "SIGAFAT", "mod_name": "Faturamento"}',
    '{"module_id": 5, "module_sigla": "SIGAFAT", "description": "Faturamento"}'
)

content = content.replace(
    '{"SIGAFAT": {"module_id": 5, "mod_code": 5, "mod_name": "Faturamento"}}',
    '{"SIGAFAT": {"module_id": 5, "description": "Faturamento"}}'
)

content = content.replace(
    '{"SIGACOM": {"module_id": 2, "mod_code": 2, "mod_name": "Compras"}}',
    '{"SIGACOM": {"module_id": 2, "description": "Compras"}}'
)


# Add resolve_clean_tenant mock
content = content.replace(
    'monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)',
    'monkeypatch.setattr(company_module_service, "ensure_tenant_tables", lambda *_args: None)\n    monkeypatch.setattr(company_module_service, "resolve_clean_tenant", lambda tid: "tenant_fixture")'
)

with open('backend/tests/test_company_crud_contract.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed tests")

from __future__ import annotations

import pytest
from app.services.protheus_module_catalog import resolve_global_module


class FakeMappings:
    def __init__(self, row: dict | None):
        self._row = row

    def first(self):
        return self._row


class FakeResult:
    def __init__(self, row: dict | None):
        self._row = row

    def mappings(self):
        return FakeMappings(self._row)


class FakeModuleDB:
    """Simula o banco com protheus_modules_master e business_domain_modules."""

    def __init__(self):
        # Master data oficial do Protheus (conforme imagem 1 do DBeaver)
        self.modules = {
            1: {"mod_code": 1, "mod_sigla": "SIGAATF", "mod_name": "Ativo Fixo"},
            2: {"mod_code": 2, "mod_sigla": "SIGACOM", "mod_name": "Compras"},
            4: {"mod_code": 4, "mod_sigla": "SIGAEST", "mod_name": "Estoque e Custos"},
            5: {"mod_code": 5, "mod_sigla": "SIGAFAT", "mod_name": "Faturamento"},
            6: {"mod_code": 6, "mod_sigla": "SIGAFIN", "mod_name": "Financeiro"},
            7: {"mod_code": 7, "mod_sigla": "SIGAGPE", "mod_name": "Gestão de Pessoal"},
            9: {"mod_code": 9, "mod_sigla": "SIGAFIS", "mod_name": "Livros Fiscais"},
            10: {"mod_code": 10, "mod_sigla": "SIGAPCP", "mod_name": "Planejamento e Controle da Produção"},
            34: {"mod_code": 34, "mod_sigla": "SIGACTB", "mod_name": "Contabilidade Gerencial"},
        }

        # Mapeamento semântico de Domínios x Módulos Protheus (conforme business_domain_modules)
        self.domain_mappings = {
            "FINANCEIRO": {"mod_code": 6, "mod_sigla": "SIGAFIN", "mod_name": "Financeiro"},
            "VENDAS": {"mod_code": 5, "mod_sigla": "SIGAFAT", "mod_name": "Faturamento"},
            "COMPRAS": {"mod_code": 2, "mod_sigla": "SIGACOM", "mod_name": "Compras"},
            "ESTOQUE": {"mod_code": 4, "mod_sigla": "SIGAEST", "mod_name": "Estoque e Custos"},
            "FISCAL": {"mod_code": 9, "mod_sigla": "SIGAFIS", "mod_name": "Livros Fiscais"},
            "CONTROLADORIA": {"mod_code": 34, "mod_sigla": "SIGACTB", "mod_name": "Contabilidade Gerencial"},
        }

    def execute(self, query, params=None):
        sql = str(query)
        p = params or {}

        # Busca em business_domain_modules
        if "FROM public.business_domain_modules" in sql:
            token = p.get("token")
            match = self.domain_mappings.get(token)
            return FakeResult(match)

        # Busca por mod_code numérico
        if ":mod_code" in sql:
            code = int(p.get("mod_code", 0))
            match = self.modules.get(code)
            return FakeResult(match)

        # Busca por sigla ou nome
        if ":token" in sql:
            token = str(p.get("token", "")).upper()
            for m in self.modules.values():
                if m["mod_sigla"] == token or f"SIGA{token}" == m["mod_sigla"] or token in m["mod_sigla"]:
                    return FakeResult(m)

        if ":sigla" in sql:
            sigla = str(p.get("sigla", "")).upper()
            for m in self.modules.values():
                if m["mod_sigla"] == sigla:
                    return FakeResult(m)

        return FakeResult(None)


def test_semantic_domains_resolve_to_correct_protheus_modules():
    db = FakeModuleDB()

    # Domínio FINANCEIRO deve resolver para SIGAFIN (mod_code 6) e JAMAIS para mod_code 1 (Ativo Fixo)
    fin = resolve_global_module(db, "FINANCEIRO")
    assert fin is not None
    assert fin["mod_sigla"] == "SIGAFIN"
    assert fin["mod_code"] == 6

    # Domínio VENDAS deve resolver para SIGAFAT (mod_code 5) e JAMAIS para mod_code 2 (Compras)
    vendas = resolve_global_module(db, "VENDAS")
    assert vendas is not None
    assert vendas["mod_sigla"] == "SIGAFAT"
    assert vendas["mod_code"] == 5

    # Domínio FISCAL deve resolver para SIGAFIS (mod_code 9) e JAMAIS para mod_code 5 (Faturamento)
    fiscal = resolve_global_module(db, "FISCAL")
    assert fiscal is not None
    assert fiscal["mod_sigla"] == "SIGAFIS"
    assert fiscal["mod_code"] == 9

    # Domínio CONTROLADORIA deve resolver para SIGACTB (mod_code 34) e JAMAIS para mod_code 6 (Financeiro)
    ctrl = resolve_global_module(db, "CONTROLADORIA")
    assert ctrl is not None
    assert ctrl["mod_sigla"] == "SIGACTB"
    assert ctrl["mod_code"] == 34


def test_numeric_tokens_always_resolve_to_protheus_master_mod_codes():
    db = FakeModuleDB()

    # mod_code 1 no Protheus é SEMPRE Ativo Fixo (SIGAATF), nunca Financeiro!
    m1 = resolve_global_module(db, 1)
    assert m1 is not None
    assert m1["mod_sigla"] == "SIGAATF"
    assert m1["mod_code"] == 1

    # mod_code 5 no Protheus é SEMPRE Faturamento (SIGAFAT), nunca Fiscal!
    m5 = resolve_global_module(db, 5)
    assert m5 is not None
    assert m5["mod_sigla"] == "SIGAFAT"
    assert m5["mod_code"] == 5

    # mod_code 6 no Protheus é SEMPRE Financeiro (SIGAFIN), nunca Controladoria!
    m6 = resolve_global_module(db, 6)
    assert m6 is not None
    assert m6["mod_sigla"] == "SIGAFIN"
    assert m6["mod_code"] == 6

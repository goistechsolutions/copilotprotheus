"""
sql_catalog.py — Catálogo de queries SQL homologadas.
Usa funções do sql_service para gerar SQL compatível com Oracle e MSSQL.
"""
from app.services.sql_service import build_select_ordered, build_select


def _catalog_oracle_or_mssql():
    """
    Gera o catálogo dinamicamente usando build_select_ordered/build_select,
    garantindo compatibilidade com Oracle (ROWNUM) e MSSQL (TOP).
    """
    return {
        'compras': {
            'pedidos_abertos': build_select_ordered(
                "SC7", "C7_EMISSAO DESC",
                extra_where="C7_RESIDUO <> '0'"
            ),
            'fornecedores': build_select_ordered(
                "SA2", "A2_NOME"
            ),
        },
        'vendas': {
            'pedidos_abertos': build_select_ordered(
                "SC5", "C5_EMISSAO DESC",
                extra_where="C5_NOTA = ' '"
            ),
            'itens_pedido': build_select_ordered(
                "SC6", "C6_NUM, C6_ITEM"
            ),
            'clientes': build_select_ordered(
                "SA1", "A1_NOME"
            ),
        },
        'estoque': {
            'saldo_produtos': build_select_ordered(
                "SB2", "B2_LOCAL, B2_COD"
            ),
            'produtos': build_select_ordered(
                "SB1", "B1_DESC"
            ),
        },
        'financeiro': {
            'titulospagar': build_select_ordered(
                "SE2", "E2_EMISSAO DESC"
            ),
            'titulosreceber': build_select_ordered(
                "SE1", "E1_EMISSAO DESC"
            ),
        },
        'fiscal': {
            'nfs_emitidas': build_select_ordered(
                "SF2", "F2_EMISSAO DESC"
            ),
            'itens_nf': build_select_ordered(
                "SFT", "FT_NFISCAL, FT_ITEM",
                limit=50  # SFT é tabela de alto volume
            ),
            'tes': build_select_ordered(
                "SF4", "F4_CODIGO"
            ),
            'livros_fiscais': build_select_ordered(
                "SFB", "FB_EMISSAO DESC"
            ),
        },
        'contabil': {
            'lancamentos': build_select_ordered(
                "CT2", "CT2_DATA DESC",
                limit=50  # CT2 é tabela crítica
            ),
            'plano_contas': build_select_ordered(
                "CTT", "CTT_CUSTO"
            ),
        },
    }


# Cache estático gerado uma vez no import
SQL_CATALOG = _catalog_oracle_or_mssql()


def get_catalog():
    """Retorna o catálogo completo de queries homologadas."""
    return SQL_CATALOG


def get_sql(module: str, query_name: str):
    """Retorna uma query específica do catálogo."""
    return SQL_CATALOG.get(module, {}).get(
        query_name,
        '-- SQL não encontrado no catálogo homologado'
    )

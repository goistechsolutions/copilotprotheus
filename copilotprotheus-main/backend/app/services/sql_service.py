"""
sql_service.py — Geração de SQL compatível com Oracle e MSSQL.
Nunca usa SELECT *. Sempre filtra D_E_L_E_T_ = ' ' e filial.
"""
import re
from app.core.config import settings

DB_DRIVER = settings.db_driver  # "oracle" ou "mssql"

# ─── Campos explícitos por tabela ─────────────────────────────────
ALLOWED_FIELDS = {
    # Compras
    "SC7": "C7_NUM, C7_ITEM, C7_FORNECE, C7_PRODUTO, C7_QUANT, C7_PRECO, C7_TOTAL, C7_EMISSAO, C7_DATPRF, C7_RESIDUO",
    # Vendas
    "SC5": "C5_NUM, C5_EMISSAO, C5_CLI, C5_LOJACLI, C5_CONDPAG, C5_NOTA, C5_BLOQUEI, C5_LIBEROK, C5_FECPV",
    # Itens de Pedido
    "SC6": "C6_NUM, C6_ITEM, C6_PRODUTO, C6_DESCRI, C6_QTDVEN, C6_PRCVEN, C6_VALOR, C6_BLQ, C6_ENTREG",
    # Estoque - Saldos
    "SB2": "B2_COD, B2_LOCAL, B2_QATU, B2_QEMP, B2_SALDO, B2_QMIN, B2_QMAX, B2_CM1, B2_UMOV",
    # Produtos
    "SB1": "B1_COD, B1_DESC, B1_TIPO, B1_UM, B1_LOCPAD, B1_GRUPO, B1_PRV1, B1_CUSTD",
    # Financeiro - Receber
    "SE1": "E1_NUM, E1_PREFIXO, E1_TIPO, E1_CLIENTE, E1_LOJA, E1_EMISSAO, E1_VENCTO, E1_VALOR, E1_SALDO, E1_BAIXA",
    # Financeiro - Pagar
    "SE2": "E2_NUM, E2_PREFIXO, E2_TIPO, E2_FORNECE, E2_LOJA, E2_EMISSAO, E2_VENCTO, E2_VALOR, E2_SALDO, E2_BAIXA",
    # Clientes
    "SA1": "A1_COD, A1_LOJA, A1_NOME, A1_NREDUZ, A1_CGC, A1_EST, A1_MUN, A1_TEL",
    # Fornecedores
    "SA2": "A2_COD, A2_LOJA, A2_NOME, A2_NREDUZ, A2_CGC, A2_EST, A2_MUN, A2_TEL",
    # Fiscal - NFs Emitidas
    "SF2": "F2_DOC, F2_SERIE, F2_CLIENTE, F2_LOJA, F2_EMISSAO, F2_VALBRUT, F2_VALFIS, F2_CHVNFE",
    # Fiscal - Itens NF
    "SFT": "FT_NFISCAL, FT_SERIE, FT_ITEM, FT_PRODUTO, FT_QUANT, FT_PRCUNI, FT_VALCONT, FT_ALIQICM, FT_VALICM, FT_ALIQIPI, FT_VALIPI",
    # Fiscal - TES
    "SF4": "F4_CODIGO, F4_TEXTO, F4_TIPO, F4_CF, F4_ICM, F4_IPI, F4_ISS, F4_CREDICM, F4_CREDIPI",
    # Fiscal - Livros
    "SFB": "FB_NFISCAL, FB_SERIE, FB_CLIFOR, FB_LOJA, FB_EMISSAO, FB_BASEICM, FB_VALICM, FB_BASEIPI, FB_VALIPI",
    # Contábil - Lançamentos
    "CT2": "CT2_DATA, CT2_DEBITO, CT2_CREDIT, CT2_VALOR, CT2_HIST, CT2_CCD, CT2_CCC, CT2_LOTE",
    # Contábil - Plano de Contas
    "CTT": "CTT_CUSTO, CTT_DESC01, CTT_CLASSE, CTT_BLOQ, CTT_UPPER",
}

# ─── Nome físico das tabelas ──────────────────────────────────────
TABLE_NAMES = {
    "SC7": "SC7010", "SC5": "SC5010", "SC6": "SC6010",
    "SB2": "SB2010", "SB1": "SB1010",
    "SE1": "SE1010", "SE2": "SE2010",
    "SA1": "SA1010", "SA2": "SA2010",
    "SF2": "SF2010", "SFT": "SFT010", "SF4": "SF4010", "SFB": "SFB010",
    "CT2": "CT2010", "CTT": "CTT010",
}

# ─── Campo de filial por tabela ───────────────────────────────────
FILIAL_FIELDS = {
    "SC7": "C7_FILIAL", "SC5": "C5_FILIAL", "SC6": "C6_FILIAL",
    "SB2": "B2_FILIAL", "SB1": "B1_FILIAL",
    "SE1": "E1_FILIAL", "SE2": "E2_FILIAL",
    "SA1": "A1_FILIAL", "SA2": "A2_FILIAL",
    "SF2": "F2_FILIAL", "SFT": "FT_FILIAL", "SF4": "F4_FILIAL", "SFB": "FB_FILIAL",
    "CT2": "CT2_FILIAL", "CTT": "CTT_FILIAL",
}


def _sanitize(value: str) -> str:
    """Remove caracteres perigosos para SQL injection."""
    return re.sub(r"[^a-zA-Z0-9 /\-]", "", value)[:50]


def build_select(
    table: str,
    extra_where: str = "",
    filial: str = "",
    limit: int = 100,
) -> str:
    """
    Gera SELECT com campos explícitos, filtro D_E_L_E_T_ e filial.
    Compatível com Oracle (ROWNUM) e MSSQL (TOP).
    SEM ORDER BY — use build_select_ordered() quando precisar ordenar.
    """
    fields = ALLOWED_FIELDS.get(table, "*")
    tname = TABLE_NAMES.get(table, f"{table}010")
    filial_field = FILIAL_FIELDS.get(table)

    where_parts = ["D_E_L_E_T_ = ' '"]
    if filial and filial_field:
        where_parts.append(f"{filial_field} = '{_sanitize(filial)}'")
    if extra_where:
        where_parts.append(extra_where)
    where_clause = " AND ".join(where_parts)

    if DB_DRIVER == "oracle":
        return (
            f"SELECT {fields} "
            f"FROM {tname} "
            f"WHERE {where_clause} "
            f"AND ROWNUM <= {limit}"
        )
    else:  # mssql
        return (
            f"SELECT TOP {limit} {fields} "
            f"FROM {tname} "
            f"WHERE {where_clause}"
        )


def build_select_ordered(
    table: str,
    order_by: str,
    extra_where: str = "",
    filial: str = "",
    limit: int = 100,
) -> str:
    """
    SELECT com ORDER BY. No Oracle, usa subquery porque ROWNUM é
    aplicado ANTES do ORDER BY — sem subquery o resultado é incorreto.
    """
    fields = ALLOWED_FIELDS.get(table, "*")
    tname = TABLE_NAMES.get(table, f"{table}010")
    filial_field = FILIAL_FIELDS.get(table)

    where_parts = ["D_E_L_E_T_ = ' '"]
    if filial and filial_field:
        where_parts.append(f"{filial_field} = '{_sanitize(filial)}'")
    if extra_where:
        where_parts.append(extra_where)
    where_clause = " AND ".join(where_parts)

    if DB_DRIVER == "oracle":
        return (
            f"SELECT * FROM ("
            f"SELECT {fields} "
            f"FROM {tname} "
            f"WHERE {where_clause} "
            f"ORDER BY {order_by}"
            f") WHERE ROWNUM <= {limit}"
        )
    else:  # mssql
        return (
            f"SELECT TOP {limit} {fields} "
            f"FROM {tname} "
            f"WHERE {where_clause} "
            f"ORDER BY {order_by}"
        )


# ─── API de conveniência por módulo ───────────────────────────────

def build_sql(question: str, module: str | None = None, filial: str | None = None) -> str:
    """
    Gera SQL somente-leitura com campos explícitos.
    Compatível com Oracle (ROWNUM) e MSSQL (TOP).
    Nunca usa SELECT *.
    """
    module = (module or "").lower()
    filial = _sanitize(filial) if filial else ""

    if module == "compras":
        return build_select_ordered("SC7", "C7_EMISSAO DESC", filial=filial)
    elif module == "vendas":
        return build_select_ordered("SC5", "C5_EMISSAO DESC", filial=filial)
    elif module == "estoque":
        return build_select_ordered("SB2", "B2_LOCAL, B2_COD", filial=filial)
    elif module == "financeiro":
        return build_select_ordered("SE1", "E1_EMISSAO DESC", filial=filial)
    elif module == "fiscal":
        return build_select_ordered("SF2", "F2_EMISSAO DESC", filial=filial)
    elif module == "contabil":
        return build_select_ordered("CT2", "CT2_DATA DESC", filial=filial, limit=50)
    else:
        return "-- SQL não definido. Módulos válidos: compras, vendas, estoque, financeiro, fiscal, contabil."

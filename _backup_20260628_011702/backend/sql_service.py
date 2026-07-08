# backend/sql_service.py  -- sem SELECT *
ALLOWED_FIELDS = {
    "SC5": "SC5.C5_NUM, SC5.C5_CLIENTE, SC5.C5_EMISSAO, SC5.C5_NOTA, SC5.C5_BLOQUEI, SC5.C5_FILIAL",
    "SC6": "SC6.C6_NUM, SC6.C6_ITEM, SC6.C6_PRODUTO, SC6.C6_DESCRI, SC6.C6_QTDVEN, SC6.C6_QTDENT, SC6.C6_PRCVEN",
    "SE1": "SE1.E1_NUM, SE1.E1_CLIENTE, SE1.E1_VENCTO, SE1.E1_VALOR, SE1.E1_SALDO, SE1.E1_TIPO",
    "SB2": "SB2.B2_COD, SB2.B2_FILIAL, SB2.B2_QATU, SB2.B2_QMIN, SB2.B2_CM1",
    "SC7": "SC7.C7_NUM, SC7.C7_FORNECE, SC7.C7_PRODUTO, SC7.C7_QUANT, SC7.C7_DATPRF, SC7.C7_RESIDUO",
}

def build_select(table: str, alias: str = None, extra_where: str = "", limit: int = 100) -> str:
    t      = alias or table
    fields = ALLOWED_FIELDS.get(table, f"{t}.*")
    return (f"SELECT TOP {limit} {fields} "
            f"FROM {'{'}RetSqlName('{table}'){'}'} {t} "
            f"WHERE {t}.D_E_L_E_T_ = '' {extra_where}")

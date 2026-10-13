import re
from typing import Dict, Iterable, Optional, Set

from fastapi import HTTPException


_SQL_WORDS = {
    "AS", "FROM", "JOIN", "WHERE", "ON", "AND", "OR", "NOT", "NULL", "IS",
    "IN", "LIKE", "BETWEEN", "GROUP", "BY", "ORDER", "HAVING", "FETCH", "FIRST",
    "NEXT", "ROWS", "ONLY", "OFFSET", "ROWNUM", "DISTINCT", "CASE", "WHEN", "THEN",
    "ELSE", "END", "ASC", "DESC", "INNER", "LEFT", "RIGHT", "FULL", "OUTER",
    "CROSS", "UNION", "ALL", "WITH", "SELECT", "FROM", "TRUE", "FALSE",
    # Funções e palavras reservadas comuns do Oracle e SQL ANSI
    "TO_CHAR", "TO_DATE", "TO_NUMBER", "SUBSTR", "NVL", "NVL2", "COALESCE",
    "TRUNC", "ROUND", "SYSDATE", "CURRENT_DATE", "ADD_MONTHS", "MONTHS_BETWEEN",
    "UPPER", "LOWER", "TRIM", "LTRIM", "RTRIM", "REPLACE", "INSTR", "LENGTH",
    "SUM", "COUNT", "AVG", "MIN", "MAX", "EXTRACT", "CAST", "MOD", "FLOOR", "CEIL",
}



class CatalogValidationError(HTTPException):
    def __init__(self, code: str, message: str, internal_details: dict):
        super().__init__(status_code=422, detail=message)
        self.code = code
        self.internal_details = internal_details

def build_protheus_context(empresa: Optional[str], filial: Optional[str]) -> Dict[str, str]:
    """Padroniza e valida o contexto operacional de empresa e filial."""
    if not empresa or not str(empresa).strip():
        raise HTTPException(
            status_code=400,
            detail="empresa/company_code é obrigatório no contexto operacional.",
        )

    if not filial or not str(filial).strip():
        raise HTTPException(
            status_code=400,
            detail="filial/branch é obrigatório no contexto operacional.",
        )

    emp_clean = str(empresa).strip()
    fil_clean = str(filial).strip()

    return {
        "empresa": emp_clean,
        "filial": fil_clean,
        "xfilial": fil_clean,
    }


_SENSITIVE_FIELD_PATTERN = re.compile(
    r"(?:PASSWORD|PASSWD|TOKEN|SECRET|JWT|CERT|PRIVATE|ACCESS[_-]?KEY|API[_-]?KEY)",
    re.IGNORECASE,
)
_MASKED_VALUE = "********************"


def mask_sensitive_rows(rows, masked_fields=None):
    """Mascara campos proibidos antes de uma resposta sair do backend."""
    configured = {
        str(field).strip().upper()
        for field in (masked_fields or [])
        if str(field).strip()
    }
    masked_rows = []
    for row in rows or []:
        if not isinstance(row, dict):
            masked_rows.append(row)
            continue
        safe_row = {}
        for key, value in row.items():
            normalized_key = str(key).strip().upper()
            if normalized_key in configured or _SENSITIVE_FIELD_PATTERN.search(normalized_key):
                safe_row[key] = _MASKED_VALUE
            else:
                safe_row[key] = value
        masked_rows.append(safe_row)
    return masked_rows


def _normalize_allowed_tables(allowed_tables: Iterable[str]) -> Set[str]:
    normalized: Set[str] = set()
    for table in allowed_tables or []:
        value = str(table or "").strip().upper()
        if not value:
            continue
        normalized.add(value)
        if len(value) == 3:
            normalized.add(f"{value}010")
        elif value.endswith("010") and len(value) > 3:
            normalized.add(value[:-3])
    return normalized


def _extract_table_refs(sql: str) -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    keyword_aliases = _SQL_WORDS | {"USING", "SET", "VALUES"}
    pattern = re.compile(
        r"\b(?:FROM|JOIN)\s+([A-Z][A-Z0-9_$#]{0,40})"
        r"(?:\s+(?:AS\s+)?([A-Z][A-Z0-9_$#]{0,40}))?",
        re.IGNORECASE,
    )
    for match in pattern.finditer(sql):
        table_name = match.group(1).upper()
        alias = (match.group(2) or "").upper()
        if alias in keyword_aliases:
            alias = ""
        refs.append((table_name, alias))
    return refs


def auto_fix_oracle_limit(sql: str) -> str:
    """
    Converte construções incompatíveis de limites para a sintaxe nativa do ORACLE:
    - SELECT TOP N col1, col2 ... -> SELECT col1, col2 ... FETCH FIRST N ROWS ONLY
    - ... LIMIT N -> ... FETCH FIRST N ROWS ONLY
    - ... LIMIT N OFFSET M -> ... OFFSET M ROWS FETCH NEXT N ROWS ONLY
    """
    if not sql or not isinstance(sql, str):
        return sql

    fixed = sql

    # 1. Trata SELECT TOP N
    top_match = re.search(r"\bSELECT\s+(?:(DISTINCT)\s+)?TOP\s+(\d+)\b", fixed, re.IGNORECASE)
    if top_match:
        distinct_part = f"{top_match.group(1)} " if top_match.group(1) else ""
        top_n = top_match.group(2)
        # Substitui "SELECT TOP N" por "SELECT "
        fixed = fixed[:top_match.start()] + f"SELECT {distinct_part}" + fixed[top_match.end():]
        # Adiciona "FETCH FIRST N ROWS ONLY" ao final se ainda não contiver limite Oracle
        if not re.search(r"\b(?:FETCH\s+FIRST|ROWNUM)\b", fixed, re.IGNORECASE):
            fixed = fixed.rstrip()
            trailing_semi = fixed.endswith(";")
            if trailing_semi:
                fixed = fixed[:-1].rstrip()
            fixed = f"{fixed} FETCH FIRST {top_n} ROWS ONLY"
            if trailing_semi:
                fixed += ";"

    # 2. Trata LIMIT N OFFSET M
    limit_offset_match = re.search(r"\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\b", fixed, re.IGNORECASE)
    if limit_offset_match:
        limit_n = limit_offset_match.group(1)
        offset_m = limit_offset_match.group(2)
        clause = f"OFFSET {offset_m} ROWS FETCH NEXT {limit_n} ROWS ONLY"
        fixed = fixed[:limit_offset_match.start()] + clause + fixed[limit_offset_match.end():]
    else:
        # 3. Trata LIMIT N
        limit_match = re.search(r"\bLIMIT\s+(\d+)\b", fixed, re.IGNORECASE)
        if limit_match:
            limit_n = limit_match.group(1)
            clause = f"FETCH FIRST {limit_n} ROWS ONLY"
            fixed = fixed[:limit_match.start()] + clause + fixed[limit_match.end():]

    return fixed


def auto_fix_delet_filters(sql: str) -> str:
    """
    Garante que toda tabela física Protheus referenciada no FROM/JOIN
    possua a cláusula obrigatória D_E_L_E_T_ <> '*'.
    Caso o LLM tenha esquecido, injeta automaticamente de forma não destrutiva.
    """
    if not sql or not isinstance(sql, str):
        return sql

    # Se contiver UNION / UNION ALL, processa cada bloco isoladamente
    union_pattern = re.compile(r"(\bUNION(?:\s+ALL)?\b)", re.IGNORECASE)
    parts = union_pattern.split(sql)
    if len(parts) > 1:
        fixed_parts = []
        for p in parts:
            if union_pattern.match(p.strip()):
                fixed_parts.append(p)
            else:
                fixed_parts.append(auto_fix_delet_filters(p))
        return "".join(fixed_parts)

    upper_sql = sql.upper()
    table_refs = _extract_table_refs(sql)
    if not table_refs:
        return sql

    missing_filters = []
    for table_name, alias in table_refs:
        # Só aplica para tabelas Protheus (ex: SE1, SE1010, SF2010, etc.)
        if not re.match(r"^[A-Z][A-Z0-9]{2}(?:010)?$", table_name):
            continue

        qualified = [f"{alias}.D_E_L_E_T_" if alias else "", f"{table_name}.D_E_L_E_T_"]
        if len(table_refs) == 1 and "D_E_L_E_T_" in upper_sql:
            continue
        if not any(q and q in upper_sql for q in qualified):
            prefix = alias if alias else table_name
            missing_filters.append(f"{prefix}.D_E_L_E_T_ <> '*'")

    if not missing_filters:
        return sql

    injected = " AND ".join(missing_filters)

    # 1. Se já possui cláusula WHERE
    where_match = re.search(r"\bWHERE\b", sql, re.IGNORECASE)
    if where_match:
        idx = where_match.end()
        return sql[:idx] + f" {injected} AND" + sql[idx:]

    # 2. Se não tem WHERE, insere antes de GROUP BY, ORDER BY, HAVING, FETCH, OFFSET
    tail_match = re.search(r"\b(GROUP\s+BY|ORDER\s+BY|HAVING|FETCH|OFFSET)\b", sql, re.IGNORECASE)
    if tail_match:
        idx = tail_match.start()
        return sql[:idx].rstrip() + f" WHERE {injected} " + sql[idx:]

    # 3. Se não tem nada disso, adiciona no final (preservando eventual ponto-e-vírgula)
    sql_stripped = sql.rstrip()
    if sql_stripped.endswith(";"):
        return sql_stripped[:-1].rstrip() + f" WHERE {injected};"
    return sql_stripped + f" WHERE {injected}"


def auto_fix_protheus_dates(sql: str) -> str:
    """
    Converte construções incompatíveis de datas (EXTRACT, YEAR, MONTH) em colunas VARCHAR2(8)
    do Protheus para a sintaxe nativa Oracle/Protheus baseada em strings 'YYYYMMDD'.
    """
    if not sql or not isinstance(sql, str):
        return sql

    # 0. SYSDATE combined: EXTRACT(MONTH/YEAR FROM col) = EXTRACT(MONTH/YEAR FROM SYSDATE)
    p0a = r"EXTRACT\s*\(\s*YEAR\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*EXTRACT\s*\(\s*YEAR\s+FROM\s+SYSDATE\s*\)\s+AND\s+EXTRACT\s*\(\s*MONTH\s+FROM\s+\1\s*\)\s*=\s*EXTRACT\s*\(\s*MONTH\s+FROM\s+SYSDATE\s*\)"
    sql = re.sub(p0a, r"SUBSTR(\1, 1, 6) = TO_CHAR(SYSDATE, 'YYYYMM')", sql, flags=re.IGNORECASE)

    p0b = r"EXTRACT\s*\(\s*MONTH\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*EXTRACT\s*\(\s*MONTH\s+FROM\s+SYSDATE\s*\)\s+AND\s+EXTRACT\s*\(\s*YEAR\s+FROM\s+\1\s*\)\s*=\s*EXTRACT\s*\(\s*YEAR\s+FROM\s+SYSDATE\s*\)"
    sql = re.sub(p0b, r"SUBSTR(\1, 1, 6) = TO_CHAR(SYSDATE, 'YYYYMM')", sql, flags=re.IGNORECASE)

    # 1. YEAR and MONTH combined with literal numbers
    p1 = r"EXTRACT\s*\(\s*YEAR\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{4})\s+AND\s+EXTRACT\s*\(\s*MONTH\s+FROM\s+\1\s*\)\s*=\s*(\d{1,2})"
    def r1(m):
        col, y, mo = m.group(1), m.group(2), m.group(3).zfill(2)
        return f"{col} LIKE '{y}{mo}%'"
    sql = re.sub(p1, r1, sql, flags=re.IGNORECASE)

    p2 = r"EXTRACT\s*\(\s*MONTH\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{1,2})\s+AND\s+EXTRACT\s*\(\s*YEAR\s+FROM\s+\1\s*\)\s*=\s*(\d{4})"
    def r2(m):
        col, mo, y = m.group(1), m.group(2).zfill(2), m.group(3)
        return f"{col} LIKE '{y}{mo}%'"
    sql = re.sub(p2, r2, sql, flags=re.IGNORECASE)

    # 2. Standalone EXTRACT(YEAR FROM col) = YYYY
    p3 = r"EXTRACT\s*\(\s*YEAR\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{4})"
    sql = re.sub(p3, r"\1 LIKE '\2%'", sql, flags=re.IGNORECASE)

    # 3. Standalone EXTRACT(MONTH FROM col) = M
    p4 = r"EXTRACT\s*\(\s*MONTH\s+FROM\s+([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{1,2})"
    def r4(m):
        col, mo = m.group(1), m.group(2).zfill(2)
        return f"SUBSTR({col}, 5, 2) = '{mo}'"
    sql = re.sub(p4, r4, sql, flags=re.IGNORECASE)

    # 4. YEAR(col) and MONTH(col)
    sql = re.sub(r"\bYEAR\s*\(\s*([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{4})", r"\1 LIKE '\2%'", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bMONTH\s*\(\s*([A-Za-z0-9_.]+)\s*\)\s*=\s*(\d{1,2})", lambda m: f"SUBSTR({m.group(1)}, 5, 2) = '{m.group(2).zfill(2)}'", sql, flags=re.IGNORECASE)

    # 5. Remove TO_CHAR em colunas nativas do Protheus (VARCHAR2(8) 'YYYYMMDD')
    # Ex: TO_CHAR(SE1.E1_VENCTO, 'YYYYMMDD') -> SE1.E1_VENCTO
    # Ex: TO_CHAR(SE2.E2_VENCTO, 'YYYYMMDD') -> SE2.E2_VENCTO
    # Exceção: preserva TO_CHAR(SYSDATE...) e TO_CHAR(ADD_MONTHS...)
    sql = re.sub(
        r"\bTO_CHAR\s*\(\s*(?!(?:SYSDATE|ADD_MONTHS|CURRENT_DATE)\b)([A-Za-z0-9_.]+)\s*,\s*['\"]YYYYMMDD['\"]\s*\)",
        r"\1",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r"\bTO_CHAR\s*\(\s*(?!(?:SYSDATE|ADD_MONTHS|CURRENT_DATE)\b)([A-Za-z0-9_.]+(?:_VENCTO|_EMISSAO|_DATA|VENCTO|EMISSAO))\s*(?:,\s*['\"][^'\"]*['\"])?\s*\)",
        r"\1",
        sql,
        flags=re.IGNORECASE,
    )

    # 6. Converte comparações diretas de strings de data Protheus com SYSDATE - N
    # Ex: HAVING MAX(SF2.F2_EMISSAO) < SYSDATE - 90 -> HAVING MAX(SF2.F2_EMISSAO) <= TO_CHAR(SYSDATE - 90, 'YYYYMMDD')
    sql = re.sub(
        r"(MAX\s*\(\s*[A-Za-z0-9_.]+(?:_EMISSAO|_VENCTO|_DATA)\s*\))\s*(<|<=)\s*SYSDATE\s*-\s*(\d+)",
        r"\1 <= TO_CHAR(SYSDATE - \3, 'YYYYMMDD')",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r"([A-Za-z0-9_.]+(?:_EMISSAO|_VENCTO|_DATA))\s*(<|<=)\s*SYSDATE\s*-\s*(\d+)",
        r"\1 <= TO_CHAR(SYSDATE - \3, 'YYYYMMDD')",
        sql,
        flags=re.IGNORECASE,
    )

    # 7. Desconsiderar e remover o campo SA1.A1_ULTCOM conforme regra de negócio
    sql = re.sub(
        r"\s*AND\s*\(\s*[A-Za-z0-9_.]*A1_ULTCOM\s+IS\s+NULL.*?\)\s*\)",
        "",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r"\s*AND\s+[A-Za-z0-9_.]*A1_ULTCOM\s*<=[^\s;]+",
        "",
        sql,
        flags=re.IGNORECASE,
    )

    # 8. Remove filtro conflitante de mês atual caso a query filtre clientes inativos por data histórica
    if re.search(r"HAVING\s+MAX\s*\([^)]+\)\s*<=\s*TO_CHAR\s*\(\s*SYSDATE\s*-\s*\d+", sql, re.IGNORECASE):
        sql = re.sub(
            r"\s*AND\s+[A-Za-z0-9_.]*F2_EMISSAO\s+LIKE\s+TO_CHAR\s*\(\s*SYSDATE\s*,\s*['\"]YYYYMM['\"]\s*\)\s*\|\|\s*['\"]%['\"]",
            "",
            sql,
            flags=re.IGNORECASE,
        )
        sql = re.sub(
            r"\s*AND\s+SUBSTR\s*\(\s*[A-Za-z0-9_.]*F2_EMISSAO\s*,\s*1\s*,\s*6\s*\)\s*=\s*TO_CHAR\s*\(\s*SYSDATE\s*,\s*['\"]YYYYMM['\"]\s*\)",
            "",
            sql,
            flags=re.IGNORECASE,
        )

    # 9. Corrige funções de grupo (MAX, MIN, SUM, COUNT, AVG) indevidamente colocadas no WHERE
    sql = auto_fix_group_functions(sql)

    return sql


def auto_fix_group_functions(sql: str) -> str:
    """
    No SQL padrão e no Oracle (ORA-00934: group function is not allowed here),
    funções agregadas (MAX, MIN, SUM, COUNT, AVG) são proibidas na cláusula WHERE.
    Esta função detecta condições agregadas indevidamente posicionadas no WHERE e as
    transfere para a cláusula HAVING.
    """
    if not sql or not isinstance(sql, str):
        return sql

    where_match = re.search(r"\bWHERE\b", sql, re.IGNORECASE)
    if not where_match:
        return sql

    where_start = where_match.start()
    after_where = sql[where_match.end():]
    boundary_match = re.search(r"\b(GROUP\s+BY|ORDER\s+BY|HAVING|FETCH|OFFSET)\b", after_where, re.IGNORECASE)

    if boundary_match:
        where_body = after_where[:boundary_match.start()]
        rest_of_query = after_where[boundary_match.start():]
    else:
        where_body = after_where
        rest_of_query = ""

    agg_pattern = r"(?:AND\s+)?(\b(?:MAX|MIN|SUM|COUNT|AVG)\s*\([^)]+\)\s*(?:<=|>=|<|>|=|!=|<>|LIKE)\s*(?:TO_CHAR\s*\([^)]+\)|[^\s\n\(\)]+))"

    agg_conditions = []
    def extract_agg(m):
        agg_conditions.append(m.group(1).strip())
        return ""

    new_where_body = re.sub(agg_pattern, extract_agg, where_body, flags=re.IGNORECASE)

    if not agg_conditions:
        return sql

    new_where_body = re.sub(r"^\s*AND\s+", " ", new_where_body, flags=re.IGNORECASE)
    new_where_body = re.sub(r"\s+AND\s*$", " ", new_where_body, flags=re.IGNORECASE)
    new_where_body = re.sub(r"\s+AND\s+AND\s+", " AND ", new_where_body, flags=re.IGNORECASE)
    new_where_body = new_where_body.strip()

    if not new_where_body:
        rebuilt = sql[:where_start].rstrip() + " " + rest_of_query.lstrip()
    else:
        rebuilt = sql[:where_match.end()] + " " + new_where_body + "\n" + rest_of_query

    agg_clause = " AND ".join(agg_conditions)

    having_match = re.search(r"\bHAVING\b", rebuilt, re.IGNORECASE)
    if having_match:
        h_end = having_match.end()
        rebuilt = rebuilt[:h_end] + f" {agg_clause} AND" + rebuilt[h_end:]
    else:
        group_match = re.search(r"\bGROUP\s+BY\b", rebuilt, re.IGNORECASE)
        if group_match:
            after_group = rebuilt[group_match.end():]
            next_clause = re.search(r"\b(ORDER\s+BY|FETCH|OFFSET)\b", after_group, re.IGNORECASE)
            if next_clause:
                idx = group_match.end() + next_clause.start()
                rebuilt = rebuilt[:idx].rstrip() + f"\nHAVING\n    {agg_clause}\n" + rebuilt[idx:]
            else:
                stripped = rebuilt.rstrip()
                if stripped.endswith(";"):
                    rebuilt = stripped[:-1].rstrip() + f"\nHAVING\n    {agg_clause};"
                else:
                    rebuilt = stripped + f"\nHAVING\n    {agg_clause}"
        else:
            order_match = re.search(r"\bORDER\s+BY\b", rebuilt, re.IGNORECASE)
            if order_match:
                idx = order_match.start()
                rebuilt = rebuilt[:idx].rstrip() + f"\nHAVING\n    {agg_clause}\n" + rebuilt[idx:]
            else:
                rebuilt = rebuilt.rstrip() + f"\nHAVING\n    {agg_clause}"

    return rebuilt


def auto_fix_protheus_joins(sql: str) -> str:
    """
    Corrige alucinações comuns em JOINs e filtros de tabelas do Protheus:
    1. SF2 com SD2: substitui F2_NUM = D2_NUM pela chave correta F2_FILIAL=D2_FILIAL AND F2_DOC=D2_DOC AND F2_SERIE=D2_SERIE.
    2. SF1 com SD1: substitui F1_NUM = D1_NUM pela chave correta F1_FILIAL=D1_FILIAL AND F1_DOC=D1_DOC AND F1_SERIE=D1_SERIE AND F1_FORNECE=D1_FORNECE AND F1_LOJA=D1_LOJA.
    3. TES SF4: D2_TES = F4_TES -> D2_TES = F4_CODIGO.
    4. Qualifica campos de itens no WHERE (como D2_TES -> SD2.D2_TES) quando a tabela tiver alias.
    """
    if not sql or not isinstance(sql, str):
        return sql

    # 1. SF2 e SD2: F2_NUM = D2_NUM ou D2_NUM = F2_NUM
    def _replace_f2_sd2_num(m):
        sf2 = m.group(1) or "SF2"
        sd2 = m.group(2) or "SD2"
        return f"{sf2}.F2_FILIAL = {sd2}.D2_FILIAL AND {sf2}.F2_DOC = {sd2}.D2_DOC AND {sf2}.F2_SERIE = {sd2}.D2_SERIE"

    sql = re.sub(
        r"\b(?:([A-Za-z0-9_]+)\.)?F2_NUM\s*=\s*(?:([A-Za-z0-9_]+)\.)?D2_NUM\b",
        _replace_f2_sd2_num,
        sql,
        flags=re.IGNORECASE,
    )
    def _replace_sd2_f2_num(m):
        sd2 = m.group(1) or "SD2"
        sf2 = m.group(2) or "SF2"
        return f"{sf2}.F2_FILIAL = {sd2}.D2_FILIAL AND {sf2}.F2_DOC = {sd2}.D2_DOC AND {sf2}.F2_SERIE = {sd2}.D2_SERIE"

    sql = re.sub(
        r"\b(?:([A-Za-z0-9_]+)\.)?D2_NUM\s*=\s*(?:([A-Za-z0-9_]+)\.)?F2_NUM\b",
        _replace_sd2_f2_num,
        sql,
        flags=re.IGNORECASE,
    )

    # 2. SF1 e SD1: F1_NUM = D1_NUM ou D1_NUM = F1_NUM
    def _replace_f1_sd1_num(m):
        sf1 = m.group(1) or "SF1"
        sd1 = m.group(2) or "SD1"
        return f"{sf1}.F1_FILIAL = {sd1}.D1_FILIAL AND {sf1}.F1_DOC = {sd1}.D1_DOC AND {sf1}.F1_SERIE = {sd1}.D1_SERIE AND {sf1}.F1_FORNECE = {sd1}.D1_FORNECE AND {sf1}.F1_LOJA = {sd1}.D1_LOJA"

    sql = re.sub(
        r"\b(?:([A-Za-z0-9_]+)\.)?F1_NUM\s*=\s*(?:([A-Za-z0-9_]+)\.)?D1_NUM\b",
        _replace_f1_sd1_num,
        sql,
        flags=re.IGNORECASE,
    )
    def _replace_sd1_f1_num(m):
        sd1 = m.group(1) or "SD1"
        sf1 = m.group(2) or "SF1"
        return f"{sf1}.F1_FILIAL = {sd1}.D1_FILIAL AND {sf1}.F1_DOC = {sd1}.D1_DOC AND {sf1}.F1_SERIE = {sd1}.D1_SERIE AND {sf1}.F1_FORNECE = {sd1}.D1_FORNECE AND {sf1}.F1_LOJA = {sd1}.D1_LOJA"

    sql = re.sub(
        r"\b(?:([A-Za-z0-9_]+)\.)?D1_NUM\s*=\s*(?:([A-Za-z0-9_]+)\.)?F1_NUM\b",
        _replace_sd1_f1_num,
        sql,
        flags=re.IGNORECASE,
    )

    # 3. SF4 (TES): D2_TES = F4_TES -> D2_TES = F4_CODIGO
    sql = re.sub(
        r"\b(?:([A-Za-z0-9_]+)\.)?F4_TES\b",
        lambda m: f"{m.group(1) or 'SF4'}.F4_CODIGO",
        sql,
        flags=re.IGNORECASE,
    )

    # 4. Qualifica campos de itens comuns no WHERE se houver alias para a tabela
    table_refs = _extract_table_refs(sql)
    for table_name, alias in table_refs:
        prefix = alias if alias else table_name
        clean_tbl = table_name[:3] if len(table_name) >= 3 else table_name
        if clean_tbl == "SD2":
            sql = re.sub(r"(?<![A-Za-z0-9_.])\b(D2_TES|D2_TOTAL|D2_QUANT|D2_COD|D2_PEDIDO)\b", rf"{prefix}.\1", sql)
        elif clean_tbl == "SD1":
            sql = re.sub(r"(?<![A-Za-z0-9_.])\b(D1_TES|D1_TOTAL|D1_QUANT|D1_COD|D1_PEDIDO)\b", rf"{prefix}.\1", sql)
        elif clean_tbl == "SF2":
            sql = re.sub(r"(?<![A-Za-z0-9_.])\b(F2_DOC|F2_SERIE|F2_EMISSAO|F2_VALBRUT|F2_VEND1|F2_CLIENTE|F2_LOJA)\b", rf"{prefix}.\1", sql)

    # 5. Tratamento de alucinação F2_TES / D2_TES: a tabela SF2 não possui campo de TES
    has_sd2 = any(t[0][:3] == "SD2" for t in table_refs)
    sd2_alias = next((t[1] or t[0] for t in table_refs if t[0][:3] == "SD2"), None)
    sf2_alias = next((t[1] or t[0] for t in table_refs if t[0][:3] == "SF2"), None)

    if has_sd2 and sd2_alias:
        # Se tem SD2, redireciona qualquer F2_TES para SD2.D2_TES
        sql = re.sub(r"\b(?:[A-Za-z0-9_]+\.)?F2_TES\b", f"{sd2_alias}.D2_TES", sql, flags=re.IGNORECASE)
    else:
        # Se NÃO tem SD2, elimina qualquer filtro de F2_TES e D2_TES (evita bloqueio RBAC 403 e erro Oracle ORA-00904)
        sql = re.sub(
            r"\s+AND\s+(?:[A-Za-z0-9_]+\.)?(?:F2_TES|D2_TES)\s*(?:IN\s*\([^)]*\)|NOT\s+IN\s*\([^)]*\)|=\s*'[^']*'|<>\s*'[^']*'|!=\s*'[^']*')",
            "",
            sql,
            flags=re.IGNORECASE,
        )
        sql = re.sub(
            r"(?:[A-Za-z0-9_]+\.)?(?:F2_TES|D2_TES)\s*(?:IN\s*\([^)]*\)|NOT\s+IN\s*\([^)]*\)|=\s*'[^']*'|<>\s*'[^']*'|!=\s*'[^']*')\s+AND\s+",
            "",
            sql,
            flags=re.IGNORECASE,
        )
        sql = re.sub(
            r"\b(?:[A-Za-z0-9_]+\.)?(?:F2_TES|D2_TES)\s*(?:IN\s*\([^)]*\)|NOT\s+IN\s*\([^)]*\)|=\s*'[^']*'|<>\s*'[^']*'|!=\s*'[^']*')",
            "1=1",
            sql,
            flags=re.IGNORECASE,
        )

        # Se houver SF2 e ainda não filtrar F2_TIPO, assegura F2_TIPO = 'N' (notas normais)
        if sf2_alias and "F2_TIPO" not in sql.upper():
            where_match = re.search(r"\bWHERE\b", sql, re.IGNORECASE)
            if where_match:
                idx = where_match.end()
                sql = sql[:idx] + f" {sf2_alias}.F2_TIPO = 'N' AND" + sql[idx:]

    return sql



def _split_select_items(body: str) -> list[str]:
    """Separa itens do SELECT sem quebrar funções, CASE ou literais."""
    items: list[str] = []
    start = 0
    depth = 0
    quote: str | None = None
    index = 0
    while index < len(body):
        char = body[index]
        if quote:
            if char == quote:
                if index + 1 < len(body) and body[index + 1] == quote:
                    index += 2
                    continue
                quote = None
        elif char in {"'", '"'}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            items.append(body[start:index])
            start = index + 1
        index += 1
    items.append(body[start:])
    return items


def _remove_select_aliases(body: str) -> str:
    """Remove aliases de apresentação, mas preserva campos físicos da expressão.

    Oracle aceita tanto ``expressao AS alias`` quanto ``expressao alias``. A
    remoção por item impede que aliases calculados com aparência de campo
    Protheus, como ``SUM(T.F1_VALBRUT) F1_TOTAL``, sejam avaliados pelo RBAC.
    """
    cleaned_items: list[str] = []
    for raw_item in _split_select_items(body):
        item = raw_item.strip()
        if not item:
            continue
        item = re.sub(
            r"\s+AS\s+(?:[A-Z][A-Z0-9_$#]*|\"(?:\"\"|[^\"])+\")\s*$",
            "",
            item,
            flags=re.IGNORECASE,
        ).strip()
        implicit = re.match(
            r"^(?P<expression>.+\S)\s+(?P<alias>[A-Z][A-Z0-9_$#]*|\"(?:\"\"|[^\"])+\")$",
            item,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if implicit:
            expression = implicit.group("expression").rstrip()
            # Só considera alias implícito quando há uma expressão composta.
            # Um campo físico isolado nunca é removido.
            if re.search(r"[().+*/|'\"]|\bCASE\b", expression, re.IGNORECASE):
                item = expression
        cleaned_items.append(item)
    return ", ".join(cleaned_items)


def _extract_select_aliases(sql: str) -> set[str]:
    """Extrai aliases definidos na cláusula SELECT (ex: SUBSTR(...) AS MES_ANO)."""
    match = re.search(r"\bSELECT\b(?P<body>.*?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return set()
    aliases: set[str] = set()
    for raw_item in _split_select_items(match.group("body")):
        item = raw_item.strip()
        if not item:
            continue
        as_match = re.search(
            r"\s+AS\s+([A-Z][A-Z0-9_$#]*|\"(?:\"\"|[^\"])+\")\s*$",
            item,
            flags=re.IGNORECASE,
        )
        if as_match:
            alias = as_match.group(1).strip().strip('"').upper()
            aliases.add(alias)
            continue
        implicit = re.match(
            r"^(?P<expression>.+\S)\s+(?P<alias>[A-Z][A-Z0-9_$#]*|\"(?:\"\"|[^\"])+\")$",
            item,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if implicit:
            expression = implicit.group("expression").rstrip()
            if re.search(r"[().+*/|'\"]|\bCASE\b", expression, re.IGNORECASE):
                alias = implicit.group("alias").strip().strip('"').upper()
                aliases.add(alias)
    return aliases


def _extract_selected_field_refs(sql: str) -> set[tuple[str | None, str]]:
    match = re.search(r"\bSELECT\b(?P<body>.*?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return set()
    body = _remove_select_aliases(match.group("body"))
    fields: set[tuple[str | None, str]] = set()
    for qualified in re.findall(r"\b([A-Z][A-Z0-9_$#]*)\.([A-Z][A-Z0-9_$#]*)\b", body, re.IGNORECASE):
        fields.add((qualified[0].upper(), qualified[1].upper()))
    for unqualified in re.findall(r"\b([A-Z][A-Z0-9_$#]*_[A-Z0-9_$#]+)\b", body, re.IGNORECASE):
        token = unqualified.upper()
        if token not in _SQL_WORDS:
            fields.add((None, token))
    return fields


def _extract_filter_field_refs(sql: str) -> set[tuple[str | None, str]]:
    bodies: list[str] = []
    match = re.search(
        r"\b(?:WHERE|GROUP\s+BY|ORDER\s+BY|HAVING)\b(?P<body>.*?)(?:\bFETCH\b|\bOFFSET\b|$)",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if match:
        bodies.append(match.group("body"))

    for on_match in re.finditer(
        r"\bON\b(?P<on_body>.*?)(?:\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|$)",
        sql,
        re.IGNORECASE | re.DOTALL,
    ):
        bodies.append(on_match.group("on_body"))

    if not bodies:
        return set()

    fields: set[tuple[str | None, str]] = set()
    qualified_pattern = re.compile(
        r"\b([A-Z][A-Z0-9_$#]*)\.([A-Z][A-Z0-9_$#]*)\b",
        re.IGNORECASE,
    )
    unqualified_pattern = re.compile(
        r"(?<!\.)\b([A-Z][A-Z0-9_$#]*_[A-Z0-9_$#]+)\b(?!\s*\()",
        re.IGNORECASE,
    )
    for raw_body in bodies:
        body = re.sub(r"'(?:''|[^'])*'", " ", raw_body)
        for qualifier, field_name in qualified_pattern.findall(body):
            fields.add((qualifier.upper(), field_name.upper()))
        for field_name in unqualified_pattern.findall(body):
            token = field_name.upper()
            if token not in _SQL_WORDS:
                fields.add((None, token))
    return fields


def _extract_selected_fields(sql: str) -> set[str]:
    match = re.search(r"\bSELECT\b(?P<body>.*?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return set()
    body = _remove_select_aliases(match.group("body"))
    fields = set()
    for qualified in re.findall(r"\b[A-Z][A-Z0-9_$#]*\.([A-Z][A-Z0-9_$#]*)\b", body, re.IGNORECASE):
        fields.add(qualified.upper())
    for unqualified in re.findall(r"\b([A-Z][A-Z0-9_$#]*_[A-Z0-9_$#]+)\b", body, re.IGNORECASE):
        token = unqualified.upper()
        if token not in _SQL_WORDS:
            fields.add(token)
    return fields


def _has_oracle_limit(sql: str) -> bool:
    return bool(
        re.search(r"\bROWNUM\s*(?:<=|<)\s*\d+", sql, re.IGNORECASE)
        or re.search(r"\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b", sql, re.IGNORECASE)
        or re.search(r"\bOFFSET\s+\d+\s+ROWS?\s+FETCH\s+NEXT\s+\d+\s+ROWS?\s+ONLY\b", sql, re.IGNORECASE)
    )


def validate_query_security(
    sql: str,
    allowed_tables: Set[str],
    filial: str,
    allowed_fields: Optional[Set[str]] = None,
    allowed_fields_by_table: Optional[Dict[str, Set[str]]] = None,
    filter_fields_by_table: Optional[Dict[str, Set[str]]] = None,
) -> bool:
    """Valida SQL Oracle contra o contexto autorizado e as regras Protheus."""
    if not sql or not sql.strip():
        raise HTTPException(status_code=400, detail="Nenhuma instrução SQL foi fornecida ou gerada para execução.")

    if not filial or not str(filial).strip():
        raise HTTPException(status_code=400, detail="filial/branch é obrigatória para validar a consulta.")

    upper_sql = sql.upper().strip()
    if not re.match(r"^(?:WITH\b[\s\S]*\bSELECT\b|SELECT\b)", upper_sql):
        raise HTTPException(status_code=400, detail="A consulta deve começar por SELECT ou WITH e ser somente leitura.")

    forbidden_keywords = [
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "EXEC",
        "CREATE", "GRANT", "REVOKE", "MERGE", "CALL", "BEGIN", "COMMIT", "ROLLBACK",
    ]
    for keyword in forbidden_keywords:
        if re.search(rf"\b{keyword}\b", upper_sql):
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança: operação '{keyword}' é proibida via consulta analítica.",
            )

    if re.search(r"\bSELECT\s+(?:DISTINCT\s+)?\*", upper_sql) or re.search(r"\b[A-Z][A-Z0-9_$#]*\.\*", upper_sql):
        raise HTTPException(status_code=400, detail="SELECT * não é permitido; selecione somente os campos necessários.")

    if re.search(r"\bSELECT\s+TOP\s+\d+", upper_sql) or re.search(r"\bLIMIT\s+\d+", upper_sql):
        raise HTTPException(status_code=400, detail="SELECT TOP/LIMIT não são permitidos no Oracle; use ROWNUM ou FETCH FIRST.")

    if "D_E_L_E_T_" not in upper_sql:
        raise HTTPException(status_code=400, detail="Toda consulta nativa deve filtrar registros excluídos com D_E_L_E_T_ <> '*'.")

    normalized_allowed = _normalize_allowed_tables(allowed_tables)
    table_refs = _extract_table_refs(upper_sql)
    if not table_refs:
        raise HTTPException(status_code=400, detail="A consulta não possui uma tabela autorizável no FROM/JOIN.")

    unknown_tables = set()
    for table_name, _alias in table_refs:
        if table_name not in normalized_allowed:
            unknown_tables.add(table_name)
    
    if unknown_tables:
        raise CatalogValidationError(
            code="SQL_CATALOG_VALIDATION_FAILED",
            message="A solicitação exigiu uma estrutura que não está disponível no dicionário autorizado. Nenhum dado foi carregado ou calculado.",
            internal_details={"unknown_tables": sorted(list(unknown_tables))}
        )

    if len(table_refs) == 1:
        if "D_E_L_E_T_" not in upper_sql:
            raise HTTPException(status_code=400, detail="Toda tabela Protheus deve filtrar D_E_L_E_T_ <> '*'.")
    else:
        for table_name, alias in table_refs:
            qualified_filters = [
                f"{alias}.D_E_L_E_T_" if alias else "",
                f"{table_name}.D_E_L_E_T_",
            ]
            if not any(filter_name and filter_name in upper_sql for filter_name in qualified_filters):
                raise HTTPException(
                    status_code=400,
                    detail=f"A tabela '{table_name}' não possui filtro lógico D_E_L_E_T_ próprio.",
                )

    if allowed_fields is not None:
        normalized_fields = {str(field).strip().upper() for field in allowed_fields if str(field).strip()}
        selected_fields = _extract_selected_fields(upper_sql)
        unauthorized = sorted(field for field in selected_fields if field not in normalized_fields and field != "D_E_L_E_T_")
        if unauthorized:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: campo(s) físico(s) ausente(s) ou não autorizado(s) no SELECT: {', '.join(unauthorized[:5])}.",
            )

    if allowed_fields_by_table is not None:
        normalized_by_table: dict[str, set[str]] = {}
        for table_name, fields in allowed_fields_by_table.items():
            normalized_fields = {str(field).strip().upper() for field in fields if str(field).strip()}
            for normalized_table in _normalize_allowed_tables([table_name]):
                normalized_by_table[normalized_table] = normalized_fields

        alias_to_table: dict[str, str] = {}
        for table_name, alias in table_refs:
            if alias:
                alias_to_table[alias] = table_name
            alias_to_table[table_name] = table_name

        selected_refs = _extract_selected_field_refs(upper_sql)
        unauthorized_refs: list[str] = []
        for qualifier, field_name in selected_refs:
            if field_name == "D_E_L_E_T_":
                continue
            if qualifier:
                resolved_table = alias_to_table.get(qualifier, qualifier)
                allowed_for_table = normalized_by_table.get(resolved_table, set())
                if field_name not in allowed_for_table:
                    unauthorized_refs.append(f"{qualifier}.{field_name}")
                continue
            tables_with_field = [
                table_name for table_name, fields in normalized_by_table.items()
                if field_name in fields
            ]
            if not tables_with_field:
                unauthorized_refs.append(field_name)

        if unauthorized_refs:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: campo(s) físico(s) ausente(s) ou não autorizado(s) para a tabela no SELECT: {', '.join(sorted(set(unauthorized_refs))[:5])}.",
            )

    effective_filter_fields = filter_fields_by_table if filter_fields_by_table else allowed_fields_by_table
    if effective_filter_fields is not None:
        normalized_filter_by_table: dict[str, set[str]] = {}
        for table_name, fields in effective_filter_fields.items():
            normalized_fields = {str(field).strip().upper() for field in fields if str(field).strip()}
            for normalized_table in _normalize_allowed_tables([table_name]):
                normalized_filter_by_table[normalized_table] = normalized_fields

        alias_to_table: dict[str, str] = {}
        for table_name, alias in table_refs:
            if alias:
                alias_to_table[alias] = table_name
            alias_to_table[table_name] = table_name

        filter_refs = _extract_filter_field_refs(upper_sql)
        select_aliases = _extract_select_aliases(upper_sql)
        unauthorized_filter_refs: list[str] = []
        for qualifier, field_name in filter_refs:
            if field_name == "D_E_L_E_T_":
                continue
            if not qualifier and field_name in select_aliases:
                continue
            if qualifier:
                resolved_table = alias_to_table.get(qualifier, qualifier)
                allowed_for_table = normalized_filter_by_table.get(resolved_table, set())
                if field_name not in allowed_for_table:
                    unauthorized_filter_refs.append(f"{qualifier}.{field_name}")
                continue
            tables_with_field = [
                table_name for table_name, fields in normalized_filter_by_table.items()
                if field_name in fields
            ]
            if not tables_with_field:
                unauthorized_filter_refs.append(field_name)

        if unauthorized_filter_refs:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: campo(s) físico(s) ausente(s) ou não autorizado(s) no WHERE/GROUP BY: {', '.join(sorted(set(unauthorized_filter_refs))[:5])}.",
            )

    return True

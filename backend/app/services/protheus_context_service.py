import re
from typing import Dict, Iterable, Optional, Set

from fastapi import HTTPException


_SQL_WORDS = {
    "AS", "FROM", "JOIN", "WHERE", "ON", "AND", "OR", "NOT", "NULL", "IS",
    "IN", "LIKE", "BETWEEN", "GROUP", "BY", "ORDER", "HAVING", "FETCH", "FIRST",
    "NEXT", "ROWS", "ONLY", "OFFSET", "ROWNUM", "DISTINCT", "CASE", "WHEN", "THEN",
    "ELSE", "END", "ASC", "DESC", "INNER", "LEFT", "RIGHT", "FULL", "OUTER",
    "CROSS", "UNION", "ALL", "WITH", "SELECT", "FROM", "TRUE", "FALSE",
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
    match = re.search(
        r"\b(?:WHERE|GROUP\s+BY|ORDER\s+BY|HAVING)\b(?P<body>.*?)(?:\bFETCH\b|\bOFFSET\b|$)",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return set()
    body = re.sub(r"'(?:''|[^'])*'", " ", match.group("body"))
    fields: set[tuple[str | None, str]] = set()
    qualified_pattern = re.compile(
        r"\b([A-Z][A-Z0-9_$#]*)\.([A-Z][A-Z0-9_$#]*)\b",
        re.IGNORECASE,
    )
    unqualified_pattern = re.compile(
        r"(?<!\.)\b([A-Z][A-Z0-9_$#]*_[A-Z0-9_$#]+)\b(?!\s*\()",
        re.IGNORECASE,
    )
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

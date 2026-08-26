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


def _extract_selected_field_refs(sql: str) -> set[tuple[str | None, str]]:
    match = re.search(r"\bSELECT\b(?P<body>.*?)\bFROM\b", sql, re.IGNORECASE | re.DOTALL)
    if not match:
        return set()
    body = match.group("body")
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
        r"\\bWHERE\\b(?P<body>.*?)(?:\\bGROUP\\s+BY\\b|\\bORDER\\s+BY\\b|\\bHAVING\\b|\\bFETCH\\b|\\bOFFSET\\b|$)",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return set()
    body = match.group("body")
    fields: set[tuple[str | None, str]] = set()
    qualified_pattern = re.compile(
        r"\\b([A-Z][A-Z0-9_$#]*)\\.([A-Z][A-Z0-9_$#]*)\\s*"
        r"(?:(?:NOT\\s+)?(?:LIKE|IN|BETWEEN|IS)|<>|!=|<=|>=|=|<|>)",
        re.IGNORECASE,
    )
    unqualified_pattern = re.compile(
        r"\\b([A-Z][A-Z0-9_$#]*_[A-Z0-9_$#]+)\\s*"
        r"(?:(?:NOT\\s+)?(?:LIKE|IN|BETWEEN|IS)|<>|!=|<=|>=|=|<|>)",
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
    body = match.group("body")
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

    if not _has_oracle_limit(upper_sql) and not re.search(r"\b(?:SUM|COUNT|MAX|MIN|AVG)\s*\(", upper_sql):
        raise HTTPException(
            status_code=400,
            detail="A consulta não agregada precisa possuir limite Oracle com ROWNUM ou FETCH FIRST.",
        )

    normalized_allowed = _normalize_allowed_tables(allowed_tables)
    table_refs = _extract_table_refs(upper_sql)
    if not table_refs:
        raise HTTPException(status_code=400, detail="A consulta não possui uma tabela autorizável no FROM/JOIN.")

    for table_name, _alias in table_refs:
        if table_name not in normalized_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: a tabela '{table_name}' não está autorizada no snapshot.",
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

    if allowed_fields:
        normalized_fields = {str(field).strip().upper() for field in allowed_fields if str(field).strip()}
        selected_fields = _extract_selected_fields(upper_sql)
        unauthorized = sorted(field for field in selected_fields if field not in normalized_fields and field != "D_E_L_E_T_")
        if unauthorized:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: campo(s) não autorizado(s) no SELECT: {', '.join(unauthorized[:5])}.",
            )

    if allowed_fields_by_table:
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
                detail=f"Bloqueio de Segurança RBAC: campo(s) não autorizado(s) no SELECT: {', '.join(sorted(set(unauthorized_refs))[:5])}.",
            )

    if filter_fields_by_table:
        normalized_filter_by_table: dict[str, set[str]] = {}
        for table_name, fields in filter_fields_by_table.items():
            normalized_fields = {str(field).strip().upper() for field in fields if str(field).strip()}
            for normalized_table in _normalize_allowed_tables([table_name]):
                normalized_filter_by_table[normalized_table] = normalized_fields

        alias_to_table: dict[str, str] = {}
        for table_name, alias in table_refs:
            if alias:
                alias_to_table[alias] = table_name
            alias_to_table[table_name] = table_name

        filter_refs = _extract_filter_field_refs(upper_sql)
        unauthorized_filter_refs: list[str] = []
        for qualifier, field_name in filter_refs:
            if field_name == "D_E_L_E_T_":
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
                detail=f"Bloqueio de Segurança RBAC: campo(s) não autorizados no WHERE: {', '.join(sorted(set(unauthorized_filter_refs))[:5])}.",
            )

    return True

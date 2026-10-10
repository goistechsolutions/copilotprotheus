"""Guard determinístico de SQL somente leitura (dialeto Oracle / Protheus QueryRest).

Regras (fail-closed: qualquer dúvida bloqueia):
  1. exatamente uma instrução;
  2. raiz SELECT (com ou sem WITH) ou UNION/INTERSECT/EXCEPT de SELECTs;
  3. nenhum nó de escrita/DDL/DCL/comando em qualquer ponto da árvore;
  4. sem comentários, ';' ou '@' (db link) fora de literais;
  5. sem SELECT ... INTO e sem FOR UPDATE;
  6. sem funções de pacotes perigosos (DBMS_*, UTL_*, SYS.*);
  7. sem SELECT * / alias.*;
  8. filtro D_E_L_E_T_ presente como coluna (não basta aparecer em literal/comentário);
  9. opcionalmente, todas as tabelas dentro de ``allowed_tables`` (allowlist do tenant).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

_FORBIDDEN_NODES = tuple(
    getattr(exp, name)
    for name in (
        "Insert", "Update", "Delete", "Merge", "Create", "Drop", "Alter",
        "TruncateTable", "Command", "Grant", "Revoke", "Set", "Use",
        "Commit", "Rollback", "Transaction", "Into", "Lock", "Pragma",
    )
    if hasattr(exp, name)
)
_FORBIDDEN_FUNC_PREFIXES = ("DBMS_", "UTL_", "SYS.", "SYS_", "APEX_", "OWA_")
_STRING_LITERAL = re.compile(r"'(?:[^']|'')*'")


@dataclass(frozen=True)
class SqlVerdict:
    allowed: bool
    reason: Optional[str] = None


def _block(reason: str) -> SqlVerdict:
    return SqlVerdict(False, reason)


def validate_readonly_oracle_sql(
    sql: str,
    *,
    require_delet_filter: bool = True,
    allowed_tables: Optional[Iterable[str]] = None,
) -> SqlVerdict:
    text = (sql or "").strip()
    if not text:
        return _block("invalid_sql")

    # 4. Checagem textual fora de literais (aspas simples).
    outside_literals = _STRING_LITERAL.sub("''", text)
    if ";" in outside_literals:
        return _block("multiple_statements")
    if "--" in outside_literals or "/*" in outside_literals:
        return _block("comments_forbidden")
    if "@" in outside_literals:
        return _block("db_link_forbidden")

    try:
        statements = [s for s in sqlglot.parse(text, read="oracle") if s is not None]
    except SqlglotError:
        return _block("invalid_sql")
    if len(statements) != 1:
        return _block("multiple_statements")
    tree = statements[0]

    # 2. Raiz precisa ser consulta.
    if not isinstance(tree, (exp.Select, exp.Union, exp.Subquery)):
        return _block("not_select")

    # 3/5/6. Varredura de nós e funções.
    for node in tree.walk():
        node = node[0] if isinstance(node, tuple) else node
        if isinstance(node, _FORBIDDEN_NODES):
            return _block("forbidden_sql")
        if isinstance(node, (exp.Anonymous, exp.Func)):
            name = (node.name or node.sql_name() or "").upper()
            if name.startswith(_FORBIDDEN_FUNC_PREFIXES):
                return _block("forbidden_function")
        if isinstance(node, exp.Dot):
            if node.sql(dialect="oracle").upper().startswith(_FORBIDDEN_FUNC_PREFIXES):
                return _block("forbidden_function")

    # 7. SELECT * / alias.*  (COUNT(*) continua permitido).
    for star in tree.find_all(exp.Star):
        parent = star.parent
        if isinstance(parent, exp.Select):
            return _block("select_star_forbidden")
        if isinstance(parent, exp.Column) and isinstance(parent.parent, exp.Select):
            return _block("select_star_forbidden")

    # 8. D_E_L_E_T_ como coluna real.
    if require_delet_filter and not any(
        col.name.upper() == "D_E_L_E_T_" for col in tree.find_all(exp.Column)
    ):
        return _block("missing_delet_filter")

    # 9. Allowlist de tabelas (CTEs próprias não contam como tabela física).
    if allowed_tables is not None:
        allowed = {str(t).strip().upper() for t in allowed_tables}
        ctes = {cte.alias_or_name.upper() for cte in tree.find_all(exp.CTE)}
        for table in tree.find_all(exp.Table):
            name = (table.name or "").upper()
            if name and name != "DUAL" and name not in ctes and name not in allowed:
                return _block("table_not_allowed")

    return SqlVerdict(True)

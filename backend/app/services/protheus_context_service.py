import re
from typing import Dict, Set, Optional
from fastapi import HTTPException


def build_protheus_context(empresa: Optional[str], filial: Optional[str]) -> Dict[str, str]:
    """
    Padroniza e valida a montagem do contexto operacional de empresa e filial (XFILIAL)
    antes de gerar ou executar consultas SQL no ERP TOTVS Protheus.
    Garante isolamento de escopo multiempresa no banco Oracle.
    """
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

    # No TOTVS Protheus, a variável de ambiente/sistema XFILIAL reflete a filial ativa da tabela
    xfilial = fil_clean

    return {
        "empresa": emp_clean,
        "filial": fil_clean,
        "xfilial": xfilial
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
            key_text = str(key)
            normalized_key = key_text.strip().upper()
            if normalized_key in configured or _SENSITIVE_FIELD_PATTERN.search(normalized_key):
                safe_row[key] = _MASKED_VALUE
            else:
                safe_row[key] = value
        masked_rows.append(safe_row)
    return masked_rows


def validate_query_security(sql: str, allowed_tables: Set[str], filial: str) -> bool:
    """
    Garante o bloqueio imediato de execução caso a consulta SQL gerada:
    1. Tente realizar operações de mutação ou DDL proibidas.
    2. Tente acessar tabelas que não estejam dentro do contexto/snapshot autorizado (RBAC/Escopo do tenant).
    3. Transgrida as Diretrizes Globais do Agente (ex: uso proibido de SELECT TOP em Oracle ou ausência do filtro D_E_L_E_T_).
    """
    if not sql or not sql.strip():
        raise HTTPException(status_code=400, detail="Nenhuma instrução SQL foi fornecida ou gerada para execução.")

    if not filial or not str(filial).strip():
        raise HTTPException(status_code=400, detail="filial/branch é obrigatória para validar a consulta.")

    upper_sql = sql.upper().strip()

    # 1. Bloquear estritamente qualquer comando não-consulta (DDL/DML de alteração)
    forbidden_keywords = [
        "INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "TRUNCATE ", 
        "EXEC ", "CREATE ", "GRANT ", "REVOKE ", "MERGE ", "CALL "
    ]
    for kw in forbidden_keywords:
        if re.search(f"\\b{kw.strip()}\\b", upper_sql):
            raise HTTPException(
                status_code=403, 
                detail=f"Bloqueio de Segurança: Operação de mutação ou DDL ('{kw.strip()}') é proibida via endpoint de consulta SQL."
            )

    # 2. Conformidade com Diretriz Global #3: NUNCA usar SELECT TOP N no ambiente Oracle
    if re.search(r'\bSELECT\s+TOP\s+\d+', upper_sql):
        raise HTTPException(
            status_code=400,
            detail="Violação da Diretriz Global #3: A sintaxe 'SELECT TOP N' é proibida no banco Oracle do Protheus na TOTVS Cloud. Deve utilizar WHERE ROWNUM <= N ou OFFSET ... FETCH NEXT."
        )

    # 3. Validar se todas as tabelas referenciadas no FROM/JOIN estão no escopo permitido do tenant
    found_tables = set(re.findall(r'\b(?:FROM|JOIN)\s+([A-Z0-9_]{2,30})', sql, re.IGNORECASE))
    
    # Normalizamos as tabelas autorizadas para conter variações (ex: SA1 e SA1010, SF2 e SF2010)
    normalized_allowed = set()
    for tbl in allowed_tables:
        t_up = tbl.upper().strip()
        normalized_allowed.add(t_up)
        if len(t_up) == 3:  # Código lógico no dicionário (ex: SA1)
            normalized_allowed.add(f"{t_up}010")
        elif t_up.endswith("010") and len(t_up) > 3:  # Nome físico da tabela no ERP (ex: SA1010)
            normalized_allowed.add(t_up[:-3])

    # Ignorar palavras-chave SQL que possam ser erroneamente apanhadas por sintaxes aninhadas
    sql_keywords = {"DUAL", "SELECT", "WHERE", "ORDER", "BY", "GROUP", "HAVING", "FETCH", "FIRST", "ROWS", "ONLY", "INNER", "LEFT", "RIGHT", "OUTER", "ON"}

    for tbl in found_tables:
        t_up = tbl.upper()
        if t_up in sql_keywords:
            continue
        # Se a tabela não casa com nenhuma tabela autorizada
        if t_up not in normalized_allowed and not any(t_up.startswith(a) for a in normalized_allowed):
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: A consulta SQL tenta acessar a tabela '{tbl}', que não está autorizada no escopo de módulos/dicionário permitido da empresa."
            )

    # 4. Verificar filtro obrigatório do Protheus para exclusões lógicas (D_E_L_E_T_ <> '*')
    if "D_E_L_E_T_" not in upper_sql:
        raise HTTPException(
            status_code=400,
            detail="Violação da Diretriz de Consulta Protheus: Toda consulta nativa deve filtrar registros excluídos no ERP, contendo explicitamente a cláusula (D_E_L_E_T_ <> '*')."
        )

    return True

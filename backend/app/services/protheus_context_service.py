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
        raise HTTPException(status_code=400, detail="O parâmetro 'empresa' é obrigatório para montagem do contexto Protheus.")

    if not filial or not str(filial).strip():
        raise HTTPException(status_code=400, detail="O parâmetro 'filial' é obrigatório para montagem do contexto Protheus.")

    emp_clean = str(empresa).strip()
    fil_clean = str(filial).strip()

    # No TOTVS Protheus, a variável de ambiente/sistema XFILIAL reflete a filial ativa da tabela
    xfilial = fil_clean

    return {
        "empresa": emp_clean,
        "filial": fil_clean,
        "xfilial": xfilial
    }


def validate_query_security(sql: str, allowed_tables: Set[str], filial: str) -> bool:
    """
    Garante o bloqueio imediato de execução caso a consulta SQL gerada:
    1. Tente realizar operações de mutação ou DDL proibidas.
    2. Tente acessar tabelas que não estejam dentro do contexto/snapshot autorizado (RBAC/Escopo do tenant).
    3. Transgrida as Diretrizes Globais do Agente (ex: uso proibido de SELECT TOP em Oracle ou ausência do filtro D_E_L_E_T_).
    """
    if not sql or not sql.strip():
        raise HTTPException(status_code=400, detail="Nenhuma instrução SQL foi fornecida ou gerada para execução.")

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

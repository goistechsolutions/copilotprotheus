"""
app/services/module_sync_resolver.py

Resolver de módulos para sincronização do dicionário por tenant.

Regras:
- A UI pode enviar a sigla (ex: 'SIGAEST') ou o código numérico (ex: '04').
- As tabelas por tenant usam o campo numérico 'modulo' como chave lógica.
- Este resolver retorna a lista de códigos numéricos (strings) para uso nas queries.
"""

from typing import List
from sqlalchemy import text
from sqlalchemy.engine import Result
from fastapi import HTTPException

def resolve_modules_to_numeric_codes(db, tenant_schema: str, selected_modules: List[str]) -> List[str]:
    """
    Resolve uma lista de módulos (siglas ou códigos) para os códigos numéricos
    armazenados em {tenant}.protheus_modules.modulo.

    Args:
        db: SQLAlchemy Session
        tenant_schema: nome do schema do tenant (ex: 'rodol')
        selected_modules: lista de strings (ex: ['SIGAEST', 'SIGACOM', '04'])

    Returns:
        lista de strings com os códigos numéricos (ex: ['04','02'])
    Raises:
        HTTPException 400 se nada for encontrado ou input inválido
    """
    if not selected_modules:
        raise HTTPException(status_code=400, detail="Selecione ao menos um módulo para sincronizar.")

    normalized = [m.strip().upper() for m in selected_modules if m and m.strip()]
    if not normalized:
        raise HTTPException(status_code=400, detail="Lista de módulos inválida.")

    # Query: tenta casar tanto com codmod (sigla) quanto com modulo (numérico).
    sql = text(f"""
        SELECT DISTINCT
            CAST(modulo AS VARCHAR) AS modulo,
            UPPER(TRIM(COALESCE(codmod, ''))) AS codmod
        FROM "{tenant_schema}".protheus_modules
        WHERE
            CAST(modulo AS VARCHAR) = ANY(:mods)
            OR UPPER(TRIM(COALESCE(codmod, ''))) = ANY(:mods)
    """)

    # Executa e obtém rows
    try:
        result: Result = db.execute(sql, {"mods": normalized})
        rows = result.fetchall()
    except Exception as e:
        # Erro DB — repassa como 500
        raise HTTPException(status_code=500, detail=f"Erro ao consultar módulos do tenant: {e}")

    if not rows:
        raise HTTPException(
            status_code=400,
            detail=f"Nenhum módulo válido encontrado no tenant para a seleção informada: {', '.join(normalized)}"
        )

    # Extrai códigos únicos
    modulo_codes = sorted({str(r.modulo).strip() for r in rows if r.modulo is not None and str(r.modulo).strip() != ""})

    if not modulo_codes:
        raise HTTPException(status_code=400, detail="Os módulos selecionados não possuem código numérico válido.")

    return modulo_codes

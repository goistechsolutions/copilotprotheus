"""
app/services/sync_dictionary_service.py

Serviço de sincronização do dicionário (tenant_schemas) por tenant.
Usa module_sync_resolver.resolve_modules_to_numeric_codes para garantir
que a busca é feita usando o código numérico do módulo (requisito arquitetural).
"""

from typing import List
from sqlalchemy import text
from fastapi import HTTPException
from sqlalchemy.engine import Result

from app.services.module_sync_resolver import resolve_modules_to_numeric_codes

def sync_selected_modules(db, tenant_schema: str, selected_modules: List[str]):
    """
    Busca linhas em {tenant}.tenant_schemas para os módulos selecionados.

    Args:
        db: SQLAlchemy Session
        tenant_schema: nome do schema (ex: 'rodol')
        selected_modules: lista de siglas ou códigos vindos do frontend

    Returns:
        list[Row] das linhas do tenant_schemas
    Raises:
        HTTPException se não encontrar ou erro
    """
    # Resolve para códigos numéricos (strings)
    modulo_codes = resolve_modules_to_numeric_codes(db, tenant_schema, selected_modules)

    if not modulo_codes:
        raise HTTPException(status_code=400, detail="Nenhum módulo resolvido para sincronização.")

    # Query: retorna todo o payload necessário para gerar snapshot local
    sql = text(f'''
        SELECT
            modulo,
            codmod,
            chave,
            tabela,
            nome,
            campo,
            campo_titulo,
            campo_tipo,
            campo_tamanho,
            campo_decimal,
            campo_obrigatorio,
            campo_usado,
            campo_descricao,
            is_customizado,
            schema_json
        FROM "{tenant_schema}".tenant_schemas
        WHERE CAST(modulo AS VARCHAR) = ANY(:modules)
        ORDER BY tabela, campo
    ''')

    try:
        result: Result = db.execute(sql, {"modules": modulo_codes})
        rows = result.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar tenant_schemas: {e}")

    if not rows:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Nenhuma tabela encontrada para os módulos selecionados: {', '.join(selected_modules)}. "
                f"Códigos resolvidos: {', '.join(modulo_codes)}."
            )
        )

    # Retorna as rows (cada row é um SQLAlchemy Row)
    return rows

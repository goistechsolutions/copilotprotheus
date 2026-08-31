"""Resolução segura de módulos para sincronização do dicionário.

A seleção aceita a sigla ou o código numérico do catálogo global
``public.protheus_modules_master``. O schema do tenant não participa da
resolução de módulos; ele é usado somente para persistir o catálogo estrutural
já associado à empresa.
"""

from typing import List

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Result


def resolve_modules_to_numeric_codes(db, tenant_schema: str, selected_modules: List[str]) -> List[str]:
    """Resolve siglas/códigos para códigos do catálogo global ativo.

    ``tenant_schema`` é mantido na assinatura por compatibilidade com os
    chamadores legados, mas não é interpolado nem consultado aqui.
    """
    del tenant_schema

    if not selected_modules:
        raise HTTPException(status_code=400, detail="Selecione ao menos um módulo para sincronizar.")

    normalized = [str(module).strip().upper() for module in selected_modules if module and str(module).strip()]
    if not normalized:
        raise HTTPException(status_code=400, detail="Lista de módulos inválida.")

    sql = text("""
        SELECT DISTINCT
            pm.mod_code::text AS modulo,
            UPPER(BTRIM(COALESCE(pm.mod_sigla, ''))) AS codmod
        FROM public.protheus_modules_master pm
        WHERE pm.active = TRUE
          AND (
                pm.mod_code::text = ANY(CAST(:mods AS text[]))
                OR UPPER(BTRIM(COALESCE(pm.mod_sigla, ''))) = ANY(CAST(:mods AS text[]))
              )
        ORDER BY pm.mod_code::text
    """)

    try:
        result: Result = db.execute(sql, {"mods": normalized})
        rows = result.fetchall()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar o catálogo global de módulos.",
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=400,
            detail=f"Nenhum módulo ativo encontrado para a seleção: {', '.join(normalized)}",
        )

    module_codes = sorted({str(row.modulo).strip() for row in rows if row.modulo is not None and str(row.modulo).strip()})
    if not module_codes:
        raise HTTPException(status_code=400, detail="Os módulos selecionados não possuem código válido.")

    return module_codes

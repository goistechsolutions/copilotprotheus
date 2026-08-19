from __future__ import annotations
import re
from typing import Any, Mapping, Sequence 
from sqlalchemy import text

_SCHEMA_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_RESERVED_SCHEMAS = {"public", "pg_catalog", "information_schema"}

def quote_tenant_schema(schema_name: str) -> str: 
    """
    Valida e retorna o nome do schema do tenant entre aspas duplas. 
    Não permite schemas reservados nem padrões inseguros.
    """
    value = str(schema_name or "").strip().lower()
    
    if not _SCHEMA_PATTERN.fullmatch(value):
        raise ValueError("schema de tenant inválido")
        
    if value in _RESERVED_SCHEMAS:
        raise ValueError("schema de tenant reservado") 
        
    return f'"{value}"'

def normalize_module_token(value: str | int | None) -> str | None: 
    """
    Normaliza o token de módulo recebido (ex.: 'FAT', 'SIGAFAT', 2). 
    Mantém a sigla completa (SIGAFAT, SIGAFIN, etc.) e permite busca 
    por parte da sigla (FAT, FIN, COM, etc.).
    """
    if value is None: 
        return None
        
    token = str(value).strip().upper() 
    if not token:
        return None
        
    token = re.sub(r"\s+", " ", token)
    # Não removemos 'SIGA' aqui; a busca será feita de forma flexível. 
    return token

def resolve_global_module( 
    db: Any,
    module: str | int | None,
) -> Mapping[str, Any] | None: 
    """
    Resolve módulo a partir do catálogo global (public.protheus_modules_master). 
    Retorna sempre mod_code, mod_sigla e mod_name.
    O join com tenant_schemas e dictionary_tables deve ser feito por mod_code. 
    """
    token = normalize_module_token(module)
    
    if not token:
        return None
        
    # Caso o caller tenha passado o código numérico direto (USR_MODULO) 
    if token.isdigit():
        row = db.execute( 
            text("""
                SELECT
                    mod_code, 
                    mod_sigla, 
                    mod_name
                FROM public.protheus_modules_master 
                WHERE mod_code = :mod_code
                  AND active = TRUE 
                LIMIT 1
            """),
            {"mod_code": int(token)},
        ).mappings().first()
        return dict(row) if row else None
        
    # Busca flexível por sigla ou nome (SIGAFAT, FAT, FATURAMENTO, etc.) 
    row = db.execute(
        text("""
            SELECT
                mod_code, 
                mod_sigla, 
                mod_name
            FROM public.protheus_modules_master 
            WHERE active = TRUE
              AND (
                  UPPER(TRIM(mod_sigla)) = :token
                  OR UPPER(TRIM(mod_sigla)) LIKE '%SIGA' || :token
                  OR UPPER(TRIM(mod_sigla)) LIKE '%' || :token || '%'
                  OR UPPER(COALESCE(mod_name, '')) LIKE '%' || :token || '%'
              )
            ORDER BY mod_code 
            LIMIT 1
        """),
        {"token": token},
    ).mappings().first()
    
    return dict(row) if row else None

def resolve_tenant_module_codes( 
    db: Any,
    tenant_schema: str, 
    module: str | int | None,
) -> list[str]: 
    """
    Retorna os códigos de módulo (mod_code) habilitados para o tenant informado. 
    O filtro é feito por {tenant}.tenant_schemas.mod_code = mod_code.
    """
    resolved = resolve_global_module(db, module)
    
    if not resolved: 
        return []
        
    schema = quote_tenant_schema(tenant_schema) 
    rows = db.execute(
        text(f"""
            SELECT DISTINCT
                mod_code::text AS module_code 
            FROM {schema}.tenant_schemas 
            WHERE mod_code = :mod_code
        """),
        {"mod_code": resolved["mod_code"]},
    ).mappings().all()
    
    return [str(row["module_code"]) for row in rows]

def require_tenant_module( 
    db: Any, 
    tenant_schema: str,
    module: str | int | None,
) -> Mapping[str, Any]: 
    """
    Valida se o módulo existe no catálogo global e está habilitado para o tenant. 
    Lança ValueError em caso de erro.
    Retorna dicionário com mod_code, mod_sigla e mod_name. 
    """
    resolved = resolve_global_module(db, module)
    
    if not resolved: 
        raise ValueError(
            "Módulo não localizado no catálogo global do Protheus."
        )
        
    allowed_codes = resolve_tenant_module_codes( 
        db,
        tenant_schema, 
        resolved["mod_code"],
    )
    
    if not allowed_codes: 
        raise ValueError(
            "Módulo não permitido para o tenant informado."
        )
        
    return {
        "mod_code": str(resolved["mod_code"]), 
        "mod_sigla": resolved["mod_sigla"], 
        "mod_name": resolved.get("mod_name"),
    }

def filter_allowed_dictionary_tables(
    db: Any, 
    tenant_schema: str,
    module_codes: Sequence[str], 
    company_id: int | None = None,
) -> list[dict[str, Any]]: 
    """
    Retorna as tabelas do dicionário permitidas para os módulos informados, 
    filtradas por tenant_schemas e, opcionalmente, por company_id.
    O join é feito por module_code = mod_code. 
    """
    if not module_codes: 
        return []
        
    schema = quote_tenant_schema(tenant_schema)
    
    params: dict[str, Any] = { 
        "module_codes": list(module_codes),
    }
    
    company_filter = ""
    if company_id is not None: 
        company_filter = """
        AND (
            dt.company_id = :company_id 
            OR dt.company_id IS NULL
        )
        """
        params["company_id"] = int(company_id)
        
    rows = db.execute( 
        text(f"""
            SELECT DISTINCT
                dt.table_code, 
                dt.table_name, 
                dt.module_code,
                COALESCE(dt.description, dt.table_name) AS description 
            FROM {schema}.dictionary_tables dt
            JOIN {schema}.tenant_schemas ts 
              ON ts.chave = dt.table_code 
             AND ts.tabela = dt.table_name
             AND ts.mod_code::text = dt.module_code 
            WHERE dt.module_code = ANY(:module_codes)
            {company_filter}
            ORDER BY dt.table_code 
        """),
        params,
    ).mappings().all()
    
    return [dict(row) for row in rows]

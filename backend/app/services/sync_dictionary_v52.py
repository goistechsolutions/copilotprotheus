"""
sync_dictionary_v52.py

Sincroniza o dicionário estrutural Protheus (SX2, SX3, SXG, SIX)
no schema do tenant no PostgreSQL.

Evolução v5.3:
- Adiciona parâmetro `module_filter` para snapshot curado por módulos.
- Usa a consulta unificada SX2+SX3+SXG quando module_filter informado.
- Mantém compatibilidade total com o snapshot completo (sem filtro).

Regras obrigatórias (Base_Conhecimento.pdf):
- Nunca inventar dados — reporta erro se Protheus estiver offline.
- Sempre respeitar D_E_L_E_T_ <> '*'.
- JOINs baseados em SIX/X2_UNICO, nunca em X3_RELACAO.
"""
import re
import os
import json
import requests
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker, Session

from app.db.database import engine
from app.services.protheus_service import get_tenant_config
from app.services.queryrest_service import queryrest_exec

logger = logging.getLogger("app.services.sync_dictionary")

# ---------------------------------------------------------------------------
# SQLs de fallback para snapshot COMPLETO (sem filtro de módulo)
# ---------------------------------------------------------------------------
SX_ENDPOINTS = {
    "SX2": "/api/framework/v1/query?table=SX2",
    "SX3": "/api/framework/v1/query?table=SX3",
    "SXG": "/api/framework/v1/query?table=SXG",
    "SIX": "/api/framework/v1/query?table=SIX",
}

SX_SQL_FALLBACK = {
    "SX2": "SELECT X2_MODULO, X2_CHAVE, X2_ARQUIVO, X2_NOME, X2_UNICO FROM SX2010 WHERE D_E_L_E_T_ <> '*'",
    "SX3": "SELECT X3_ARQUIVO, X3_CAMPO, X3_TITULO, X3_TIPO, X3_TAMANHO, X3_DECIMAL, X3_OBRIGAT, X3_VISUAL, X3_CONTEXT, X3_VALID, X3_RELACAO, X3_WHEN FROM SX3010 WHERE D_E_L_E_T_ <> '*'",
    "SXG": "SELECT XG_GRUPO, XG_DESC, XG_SIZEMAX, XG_SIZEMIN, XG_SIZE FROM SXG010 WHERE D_E_L_E_T_ <> '*'",
    "SIX": "SELECT INDICE AS SIX_ARQUIVO, ORDEM AS SIX_ORDEM, CHAVE AS SIX_CHAVE, DESCRIC AS SIX_DESCRIC FROM SIX010 WHERE D_E_L_E_T_ <> '*'",
}

# ---------------------------------------------------------------------------
# SQL unificada para snapshot CURADO por módulos (SX2+SX3+SXG em uma chamada)
# ---------------------------------------------------------------------------
SQL_DICT_BY_MODULES = """
SELECT
 X2.X2_MODULO,
 X2.X2_CHAVE,
 X2.X2_ARQUIVO,
 X2.X2_NOME,
 X2.X2_TAMFIL,
 X2.X2_MODO,
 X2.X2_TAMUN,
 X2.X2_MODOUN,
 X2.X2_TAMEMP,
 X2.X2_MODOEMP,
 X2.X2_UNICO,
 X3.X3_CAMPO,
 X3.X3_DESCRIC,
 X3.X3_TIPO,
 X3.X3_TAMANHO,
 X3.X3_GRPSXG,
 XG.XG_SIZE,
 CASE
   WHEN X2.X2_MODOEMP='E' AND NVL(X2.X2_TAMEMP,0)>0
   THEN 'S' ELSE 'N'
 END AS USA_EMPRESA,
 CASE
   WHEN X2.X2_MODOUN='E' AND NVL(X2.X2_TAMUN,0)>0
   THEN 'S' ELSE 'N'
 END AS USA_UNIDADE,
 CASE
   WHEN X2.X2_MODO='E' AND NVL(X2.X2_TAMFIL,0)>0
   THEN 'S' ELSE 'N'
 END AS USA_FILIAL
FROM SX2010 X2
INNER JOIN SX3010 X3
 ON X2.X2_CHAVE = X3.X3_ARQUIVO
 AND X3.D_E_L_E_T_ <> '*'
LEFT JOIN SXG010 XG
 ON X3.X3_GRPSXG = XG.XG_GRUPO
 AND XG.D_E_L_E_T_ <> '*'
WHERE X2.D_E_L_E_T_ <> '*'
 AND X2.X2_MODULO IN ({modules_in})
ORDER BY X2.X2_MODULO, X2.X2_CHAVE, X3.X3_CAMPO
"""

SQL_SIX_BY_MODULES = """
SELECT
 SI.INDICE   AS SIX_ORDEM,
 SI.CHAVE    AS SIX_CHAVE,
 SI.DESCRIC  AS SIX_DESCRIC,
 SI.TABELA   AS SIX_ARQUIVO
FROM SIX010 SI
INNER JOIN SX2010 X2
 ON SI.TABELA = X2.X2_CHAVE
 AND X2.D_E_L_E_T_ <> '*'
 AND X2.X2_MODULO IN ({modules_in})
WHERE SI.D_E_L_E_T_ <> '*'
ORDER BY SI.TABELA, SI.INDICE
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_modules_in(modules: List[str]) -> str:
    """Monta o IN clause seguro com aspas simples."""
    return ", ".join(f"'{m.strip().upper()}'" for m in modules if m.strip())


def fetch_rows_from_protheus(tenant_id: str, source_type: str) -> List[Dict[str, Any]]:
    """
    Obtém metadados do Protheus real do cliente (snapshot COMPLETO).
    Prioriza API Framework; fallback para QueryRest SQL nativo.
    Nunca inventa valores.
    """
    try:
        config   = get_tenant_config(tenant_id)
        base_url = config.get("rest_url", "").strip()
        token    = config.get("token", "").strip()
    except Exception:
        base_url = os.getenv("PROTHEUS_REST_BASE", "").strip()
        token    = os.getenv("PROTHEUS_TOKEN", "").strip()

    if not base_url:
        raise RuntimeError(
            f"Configuração REST não encontrada para o tenant '{tenant_id}'. "
            "Conforme regra de Fidelidade aos Dados Reais, dados simulados não são permitidos."
        )

    base_url = base_url.rstrip("/")
    headers  = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # Tentativa 1: API Framework
    url_fw = f"{base_url}{SX_ENDPOINTS[source_type]}"
    try:
        res = requests.get(url_fw, headers=headers, timeout=30)
        if res.status_code == 200:
            data  = res.json()
            items = data.get("items") or data.get("result") or (data if isinstance(data, list) else [])
            logger.info(f"[Sync] Framework OK {url_fw}: {len(items)} registros.")
            return items
    except requests.exceptions.RequestException as e:
        logger.warning(f"[Sync] Framework indisponível ({url_fw}): {e}. Tentando QueryRest...")

    # Tentativa 2: QueryRest SQL nativo
    url_qr = f"{base_url}/QueryRest"
    sql     = SX_SQL_FALLBACK[source_type]
    try:
        res2 = requests.post(url_qr, json={"cQuery": sql}, headers=headers, timeout=45)
        if res2.status_code == 200:
            data2  = res2.json()
            items2 = data2.get("items") or data2.get("result") or (data2 if isinstance(data2, list) else [])
            logger.info(f"[Sync] QueryRest OK {source_type}: {len(items2)} registros.")
            return items2
        raise RuntimeError(f"QueryRest HTTP {res2.status_code}: {res2.text[:300]}")
    except Exception as e2:
        raise RuntimeError(
            f"Falha total na sincronização de {source_type} ({base_url}): {e2}"
        )


def fetch_curated_by_modules(
    db: Any,
    tenant_code: str,
    modules: List[str],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Busca dicionário CURADO pelos módulos selecionados via QueryRest direta,
    utilizando a nova camada Bearer Token (ProtheusQueryRestClient).
    """
    modules_in = _build_modules_in(modules)
    if not modules_in:
        raise ValueError("Lista de módulos vazia — impossível montar filtro IN.")

    sql_dict = SQL_DICT_BY_MODULES.format(modules_in=modules_in)
    sql_six  = SQL_SIX_BY_MODULES.format(modules_in=modules_in)

    logger.info(f"[Sync Curado] Buscando dicionário para módulos: {modules}")

    from app.services.protheus_queryrest_client import ProtheusQueryRestClient
    import asyncio

    client = ProtheusQueryRestClient(
        db=db,
        tenant_code=tenant_code,
        environment_code="default"
    )

    # Use asyncio.run if there is no running loop, otherwise get event loop
    try:
        loop = asyncio.get_running_loop()
        dict_rows = loop.run_until_complete(client.execute(sql_dict, method="POST"))
        six_rows  = loop.run_until_complete(client.execute(sql_six, method="POST"))
    except RuntimeError:
        dict_rows = asyncio.run(client.execute(sql_dict, method="POST"))
        six_rows  = asyncio.run(client.execute(sql_six, method="POST"))

    if isinstance(dict_rows, dict):
        dict_rows = dict_rows.get("items") or dict_rows.get("data") or []
    if isinstance(six_rows, dict):
        six_rows = six_rows.get("items") or six_rows.get("data") or []

    logger.info(f"[Sync Curado] Retornados {len(dict_rows)} campos e {len(six_rows)} índices.")
    return {"dict_rows": dict_rows, "six_rows": six_rows}


def run_snapshot(
    tenant_id: str,
    environment_id: str = "producao",
    company_id: Optional[str] = None,
    
    session: Optional[Session] = None,
    module_filter: Optional[List[str]] = None,
    rest_url: Optional[str] = None,
    protheus_user: Optional[str] = None,
    encrypted_password: Optional[str] = None,
):
    """
    Executa a sincronização do dicionário estrutural (SX2, SX3, SXG, SIX)
    do ERP Protheus, registrando apenas metadados sem dados operacionais/transacionais.
    Suporta filtragem opcional por module_filter (módulos contratados da empresa).
    """
    own_session = False

    import re
    from app.db.database import get_tenant_session, ensure_tenant_tables
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant:
        clean_tenant = "default"

    if session is None:
        session      = get_tenant_session(clean_tenant)
        own_session  = True
    else:
        if clean_tenant != "public":
            ensure_tenant_tables(session, clean_tenant)
            session.execute(text(f'SET search_path TO "{clean_tenant}", public'))

    allowed_snapshot_tables = set()
    try:
        # ── MODO CURADO DIRETO: snapshot filtrado por módulos via credenciais REST informadas ────────────────────────
        if module_filter:
            logger.info(f"[Snapshot Curado via REST Direto] tenant={tenant_id} módulos={module_filter}")

            data = fetch_curated_by_modules(
                db=session, tenant_code=clean_tenant, modules=module_filter
            )
            dict_rows = data["dict_rows"]
            six_rows  = data["six_rows"]

            _persist_dict_rows(session, dict_rows, tenant_id, company_id, environment_id)
            _persist_six_rows(session, six_rows, tenant_id, company_id, environment_id)
            session.commit()

            return {
                
                "status": "done",
                "mode": "curated",
                "modules": module_filter,
                "total_fields": len(dict_rows),
                "total_indexes": len(six_rows),
                "message": "Snapshot curado por módulos concluído com sucesso.",
            }

        # ── MODO COMPLETO: snapshot do dicionário inteiro ─────────────────────
        for source_type in ["SX2", "SX3", "SXG", "SIX"]:
            _mark_source(session, tenant_id, company_id, environment_id, source_type, "running")

            try:
                rows = fetch_rows_from_protheus(tenant_id, source_type)
            except Exception as e:
                _mark_source(session, tenant_id, company_id, environment_id, source_type, "failed", str(e))
                raise e

            if source_type == "SX2":
                for r in rows:
                    t_name = str(r.get("X2_CHAVE") or r.get("table_name") or "").strip().upper()
                    mod_code = str(r.get("X2_MODULO") or r.get("module_code") or "").strip()
                    if module_filter and len(module_filter) > 0 and mod_code not in module_filter:
                        continue
                    allowed_snapshot_tables.add(t_name)
                    session.execute(text("""
                        INSERT INTO dictionary_tables
                        (tenant_id, company_id, environment_id,
                         table_name, table_alias, module_code, description, physical_name, raw_payload)
                        VALUES (:tenant_id,:company_id,:environment_id,
                                :table_name,:table_alias,:module_code,:description,:physical_name,
                                CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, table_name)
                        DO UPDATE SET
                            table_alias=EXCLUDED.table_alias, module_code=EXCLUDED.module_code,
                            description=EXCLUDED.description, physical_name=EXCLUDED.physical_name,
                            raw_payload=EXCLUDED.raw_payload, updated_at=NOW()
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id),
                        "table_name": t_name,
                        "table_alias": str(r.get("X2_ARQUIVO") or r.get("table_alias") or "").strip(),
                        "module_code": mod_code,
                        "description": str(r.get("X2_NOME") or r.get("description") or "").strip(),
                        "physical_name": str(r.get("X2_ARQFIS") or r.get("physical_name") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })
            elif source_type == "SX3":
                for r in rows:
                    table_name = str(r.get("X3_ARQUIVO") or r.get("table_name") or "").strip().upper()
                    if module_filter and len(module_filter) > 0 and allowed_snapshot_tables and table_name not in allowed_snapshot_tables:
                        continue
                    session.execute(text("""
                        INSERT INTO dictionary_fields
                        (tenant_id, company_id, environment_id,
                         table_name, field_name, title, field_type, length_num, decimal_num,
                         required_flag, browse_flag, virtual_flag,
                         validation_rule, relation_rule, when_rule, raw_payload)
                        VALUES (:tenant_id,:company_id,:environment_id,
                                :table_name,:field_name,:title,:field_type,:length_num,:decimal_num,
                                :required_flag,:browse_flag,:virtual_flag,
                                :validation_rule,:relation_rule,:when_rule,
                                CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, table_name, field_name)
                        DO UPDATE SET
                            title=EXCLUDED.title, field_type=EXCLUDED.field_type,
                            length_num=EXCLUDED.length_num, decimal_num=EXCLUDED.decimal_num,
                            required_flag=EXCLUDED.required_flag, browse_flag=EXCLUDED.browse_flag,
                            virtual_flag=EXCLUDED.virtual_flag, validation_rule=EXCLUDED.validation_rule,
                            relation_rule=EXCLUDED.relation_rule, when_rule=EXCLUDED.when_rule,
                            raw_payload=EXCLUDED.raw_payload, updated_at=NOW()
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id),
                        "table_name": table_name,
                        "field_name": str(r.get("X3_CAMPO") or r.get("field_name") or "").strip().upper(),
                        "title": str(r.get("X3_TITULO") or r.get("title") or "").strip(),
                        "field_type": str(r.get("X3_TIPO") or r.get("field_type") or "").strip(),
                        "length_num": int(r.get("X3_TAMANHO") or r.get("length_num") or 0) or None,
                        "decimal_num": int(r.get("X3_DECIMAL") or r.get("decimal_num") or 0) or None,
                        "required_flag": str(r.get("X3_OBRIGAT", "")).strip().upper() in ("S", "1", "T", "TRUE"),
                        "browse_flag": str(r.get("X3_VISUAL", "")).strip().upper() in ("S", "1", "T", "TRUE", "V"),
                        "virtual_flag": str(r.get("X3_CONTEXT", "")).strip().upper() == "V",
                        "validation_rule": str(r.get("X3_VALID") or "").strip(),
                        "relation_rule": str(r.get("X3_RELACAO") or "").strip(),
                        "when_rule": str(r.get("X3_WHEN") or "").strip(),
                        "raw_payload": json.dumps(r),
                    })
            elif source_type == "SIX":
                for r in rows:
                    table_name = str(r.get("SIX_ARQUIVO") or r.get("table_name") or "").strip().upper()
                    if module_filter and len(module_filter) > 0 and allowed_snapshot_tables and table_name not in allowed_snapshot_tables:
                        continue
                    session.execute(text("""
                        INSERT INTO dictionary_indexes
                        (tenant_id, company_id, environment_id,
                         table_name, index_order, nickname, expression, raw_payload)
                        VALUES (:tenant_id,:company_id,:environment_id,
                                :table_name,:index_order,:nickname,:expression,
                                CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, table_name, index_order)
                        DO UPDATE SET
                            nickname=EXCLUDED.nickname, expression=EXCLUDED.expression,
                            raw_payload=EXCLUDED.raw_payload
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id),
                        "table_name": table_name,
                        "index_order": str(r.get("SIX_ORDEM") or r.get("index_order") or "").strip(),
                        "nickname": str(r.get("SIX_DESCRIC") or r.get("nickname") or "").strip(),
                        "expression": str(r.get("SIX_CHAVE") or r.get("expression") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })
            elif source_type == "SXG":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_groups
                        (tenant_id, company_id, environment_id,
                         group_name, description, raw_payload)
                        VALUES (:tenant_id,:company_id,:environment_id,
                                :group_name,:description,CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, group_name)
                        DO UPDATE SET description=EXCLUDED.description, raw_payload=EXCLUDED.raw_payload
                    """), {
                        "tenant_id": str(tenant_id),
                        "company_id": str(company_id) if company_id else None,
                        "environment_id": str(environment_id),
                        
                        "group_name": str(r.get("XG_GRUPO") or "").strip().upper(),
                        "description": str(r.get("XG_DESC") or "").strip(),
                        "raw_payload": json.dumps(r),
                    })

            _mark_source(session, tenant_id, company_id, environment_id, source_type, "done")
            session.commit()

        return {
            
            "status": "done",
            "mode": "full",
            "message": "Dicionário Protheus sincronizado com sucesso.",
        }

    except Exception as ex:
        session.rollback()
        raise ex
    finally:
        if own_session:
            session.close()


# ---------------------------------------------------------------------------
# Helpers de persistência
# ---------------------------------------------------------------------------

def _mark_source(session, tenant_id, company_id, environment_id, source_type, status, error=None):
    if status == "running":
        session.execute(text("""
            INSERT INTO tenant_dictionary_sources
            (tenant_id, company_id, environment_id, source_type, status, started_at)
            VALUES (:tenant_id,:company_id,:environment_id,:source_type,'running',NOW())
        """), {
            "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None,
            "environment_id": str(environment_id), "source_type": source_type,
            
        })
    elif status == "failed":
        session.execute(text("""
            UPDATE tenant_dictionary_sources
            SET status='failed', finished_at=NOW(), error_message=:err
            WHERE tenant_id=:tenant_id AND source_type=:source_type
        """), {"tenant_id": str(tenant_id), 
               "source_type": source_type, "err": str(error)})
    else:
        session.execute(text("""
            UPDATE tenant_dictionary_sources
            SET status='done', finished_at=NOW()
            WHERE tenant_id=:tenant_id AND source_type=:source_type
        """), {"tenant_id": str(tenant_id),  "source_type": source_type})
    session.commit()


def _persist_dict_rows(session, rows, tenant_id, company_id, environment_id):
    """
    Persiste resultado da consulta unificada SX2+SX3+SXG (snapshot curado).
    Cada linha representa uma combinação tabela+campo com flags de compartilhamento.
    """
    for r in rows:
        table_key = str(r.get("X2_CHAVE") or "").strip().upper()
        if not table_key:
            continue

        # Upsert em dictionary_tables
        session.execute(text("""
            INSERT INTO dictionary_tables
            (tenant_id, company_id, environment_id,
             table_name, table_alias, module_code, description,
             usa_empresa, usa_unidade, usa_filial,
             x2_modo, x2_tamfil, x2_modoun, x2_tamun, x2_modoemp, x2_tamemp,
             unique_index, raw_payload)
            VALUES (:tenant_id,:company_id,:environment_id,
                    :table_name,:table_alias,:module_code,:description,
                    :usa_empresa,:usa_unidade,:usa_filial,
                    :x2_modo,:x2_tamfil,:x2_modoun,:x2_tamun,:x2_modoemp,:x2_tamemp,
                    :unique_index,CAST(:raw_payload AS JSONB))
            ON CONFLICT (tenant_id, environment_id, table_name)
            DO UPDATE SET
                table_alias=EXCLUDED.table_alias, module_code=EXCLUDED.module_code,
                description=EXCLUDED.description,
                usa_empresa=EXCLUDED.usa_empresa, usa_unidade=EXCLUDED.usa_unidade,
                usa_filial=EXCLUDED.usa_filial,
                x2_modo=EXCLUDED.x2_modo, x2_modoun=EXCLUDED.x2_modoun,
                x2_modoemp=EXCLUDED.x2_modoemp, unique_index=EXCLUDED.unique_index,
                raw_payload=EXCLUDED.raw_payload, updated_at=NOW()
        """), {
            "tenant_id": str(tenant_id),
            "company_id": str(company_id) if company_id else None,
            "environment_id": str(environment_id),
            
            "table_name": table_key,
            "table_alias": str(r.get("X2_ARQUIVO") or "").strip(),
            "module_code": str(r.get("X2_MODULO") or "").strip(),
            "description": str(r.get("X2_NOME") or "").strip(),
            "usa_empresa": str(r.get("USA_EMPRESA") or "N").strip(),
            "usa_unidade": str(r.get("USA_UNIDADE") or "N").strip(),
            "usa_filial":  str(r.get("USA_FILIAL") or "N").strip(),
            "x2_modo":    str(r.get("X2_MODO") or "").strip(),
            "x2_tamfil":  r.get("X2_TAMFIL"),
            "x2_modoun":  str(r.get("X2_MODOUN") or "").strip(),
            "x2_tamun":   r.get("X2_TAMUN"),
            "x2_modoemp": str(r.get("X2_MODOEMP") or "").strip(),
            "x2_tamemp":  r.get("X2_TAMEMP"),
            "unique_index": str(r.get("X2_UNICO") or "").strip(),
            "raw_payload": json.dumps(r),
        })

        # Upsert em dictionary_fields
        field_name = str(r.get("X3_CAMPO") or "").strip().upper()
        if not field_name:
            continue

        session.execute(text("""
            INSERT INTO dictionary_fields
            (tenant_id, company_id, environment_id,
             table_name, field_name, title, field_type, length_num,
             sxg_group, sxg_size, raw_payload)
            VALUES (:tenant_id,:company_id,:environment_id,
                    :table_name,:field_name,:title,:field_type,:length_num,
                    :sxg_group,:sxg_size,CAST(:raw_payload AS JSONB))
            ON CONFLICT (tenant_id, environment_id, table_name, field_name)
            DO UPDATE SET
                title=EXCLUDED.title, field_type=EXCLUDED.field_type,
                length_num=EXCLUDED.length_num, sxg_group=EXCLUDED.sxg_group,
                sxg_size=EXCLUDED.sxg_size, raw_payload=EXCLUDED.raw_payload,
                updated_at=NOW()
        """), {
            "tenant_id": str(tenant_id),
            "company_id": str(company_id) if company_id else None,
            "environment_id": str(environment_id),
            
            "table_name": table_key,
            "field_name": field_name,
            "title":      str(r.get("X3_DESCRIC") or "").strip(),
            "field_type": str(r.get("X3_TIPO") or "").strip(),
            "length_num": r.get("X3_TAMANHO"),
            "sxg_group":  str(r.get("X3_GRPSXG") or "").strip(),
            "sxg_size":   r.get("XG_SIZE"),
            "raw_payload": json.dumps(r),
        })


def _persist_six_rows(session, rows, tenant_id, company_id, environment_id):
    """Persiste índices SIX do snapshot curado."""
    for r in rows:
        table_name = str(r.get("SIX_ARQUIVO") or "").strip().upper()
        index_order = str(r.get("SIX_ORDEM") or "").strip()
        if not table_name or not index_order:
            continue

        session.execute(text("""
            INSERT INTO dictionary_indexes
            (tenant_id, company_id, environment_id,
             table_name, index_order, nickname, expression, raw_payload)
            VALUES (:tenant_id,:company_id,:environment_id,
                    :table_name,:index_order,:nickname,:expression,
                    CAST(:raw_payload AS JSONB))
            ON CONFLICT (tenant_id, environment_id, table_name, index_order)
            DO UPDATE SET
                nickname=EXCLUDED.nickname, expression=EXCLUDED.expression,
                raw_payload=EXCLUDED.raw_payload
        """), {
            "tenant_id": str(tenant_id),
            "company_id": str(company_id) if company_id else None,
            "environment_id": str(environment_id),
            
            "table_name": table_name,
            "index_order": index_order,
            "nickname":    str(r.get("SIX_DESCRIC") or "").strip(),
            "expression":  str(r.get("SIX_CHAVE") or "").strip(),
            "raw_payload": json.dumps(r),
        })

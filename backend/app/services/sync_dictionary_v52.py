import os
import json
import requests
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.db.database import get_db, engine
from app.services.protheus_service import get_tenant_config

logger = logging.getLogger("app.services.sync_dictionary")

SX_ENDPOINTS = {
    "SX2": "/api/framework/v1/query?table=SX2",
    "SX3": "/api/framework/v1/query?table=SX3",
    "SXG": "/api/framework/v1/query?table=SXG",
    "SIX": "/api/framework/v1/query?table=SIX",
}

SX_SQL_FALLBACK = {
    "SX2": "SELECT X2_CHAVE, X2_ARQUIVO, X2_MODULO, X2_NOME, X2_ARQFIS FROM SX2010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 3000",
    "SX3": "SELECT X3_ARQUIVO, X3_CAMPO, X3_TITULO, X3_TIPO, X3_TAMANHO, X3_DECIMAL, X3_OBRIGAT, X3_VISUAL, X3_CONTEXT, X3_VALID, X3_RELACAO, X3_WHEN FROM SX3010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 10000",
    "SXG": "SELECT XG_GRUPO, XG_DESC FROM SXG010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 2000",
    "SIX": "SELECT INDICE AS SIX_ORDEM, CHAVE AS SIX_CHAVE, DESCRIC AS SIX_DESCRIC, TABELA AS SIX_ARQUIVO FROM SIX010 WHERE D_E_L_E_T_ <> '*' AND ROWNUM <= 5000",
}

def fetch_rows_from_protheus(tenant_id: str, source_type: str) -> List[Dict[str, Any]]:
    """
    Obtém as linhas de dicionário (metadados estruturais) do Protheus real do cliente.
    Prioriza consulta REST framework; em caso de 404, utiliza consulta SQL nativa Oracle 
    via endpoint /QueryRest conforme Diretriz Global 1.
    Nunca inventa valores (Diretriz Global 2).
    """
    # 1. Obter credenciais reais do tenant
    try:
        config = get_tenant_config(tenant_id)
        base_url = config.get("rest_url", "").strip()
        token = config.get("token", "").strip()
    except Exception as e:
        base_url = os.getenv("PROTHEUS_REST_BASE", "").strip()
        token = os.getenv("PROTHEUS_TOKEN", "").strip()

    if not base_url:
        raise RuntimeError(
            f"Configuração REST (URL/Token) não encontrada para o tenant '{tenant_id}'. "
            "Conforme Diretriz 2 (Fidelidade aos Dados Reais), não é permitido simular ou inventar dados de dicionário."
        )

    if base_url.endswith("/"):
        base_url = base_url[:-1]
        
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {"Content-Type": "application/json"}

    # Tentativa 1: Framework Query API REST
    url_framework = f"{base_url}{SX_ENDPOINTS[source_type]}"
    try:
        res = requests.get(url_framework, headers=headers, timeout=30)
        if res.status_code == 200:
            data = res.json()
            items = data.get("items") or data.get("result") or (data if isinstance(data, list) else [])
            logger.info(f"[Sync v5.2] Sucesso na leitura via {url_framework}: {len(items)} registros encontrados.")
            return items
    except requests.exceptions.RequestException as err_rest:
        logger.warning(f"[Sync v5.2] Endpoint {url_framework} indisponível: {err_rest}. Tentando fallback /QueryRest...")

    # Tentativa 2: Consulta SQL Nativa via /QueryRest (Diretriz Global 1 e 3)
    url_query_rest = f"{base_url}/QueryRest"
    sql_query = SX_SQL_FALLBACK.get(source_type, "")
    try:
        res_sql = requests.post(url_query_rest, json={"cQuery": sql_query}, headers=headers, timeout=45)
        if res_sql.status_code == 200:
            data_sql = res_sql.json()
            items = data_sql.get("items") or data_sql.get("result") or (data_sql if isinstance(data_sql, list) else [])
            logger.info(f"[Sync v5.2] Sucesso na leitura de {source_type} via /QueryRest: {len(items)} registros.")
            return items
        else:
            raise RuntimeError(f"Erro no /QueryRest ({res_sql.status_code}): {res_sql.text}")
    except Exception as err_sql:
        logger.error(f"[Sync v5.2] Falha completa na sincronização real do {source_type}: {err_sql}")
        raise RuntimeError(
            f"Não foi possível se conectar às APIs REST/QueryRest do Protheus real ({base_url}) para carregar a tabela {source_type}. "
            f"Erro: {err_sql}. Conforme regra de Fidelidade aos Dados Reais, o sistema relata o ambiente offline e N NUNCA gera dados simulados."
        )

def run_snapshot(tenant_id: str, environment_id: str = "producao", company_id: Optional[str] = None, snapshot_code: Optional[str] = None, session: Optional[Session] = None):
    """
    Executa a sincronização assíncrona ou síncrona do dicionário estrutural (SX2, SX3, SXG, SIX)
    do ERP Protheus, registrando apenas metadados sem qualquer dado transacional/operacional do cliente.
    """
    snapshot_code = snapshot_code or datetime.utcnow().strftime("%Y%m%d%H%M%S")
    own_session = False
    if session is None:
        SessionLocal = sessionmaker(bind=engine)
        session = SessionLocal()
        own_session = True

    try:
        for source_type in ["SX2", "SX3", "SXG", "SIX"]:
            # Cria registro em tenant_dictionary_sources como 'running'
            session.execute(text("""
                INSERT INTO tenant_dictionary_sources
                (tenant_id, company_id, environment_id, source_type, snapshot_code, status, started_at)
                VALUES (:tenant_id, :company_id, :environment_id, :source_type, :snapshot_code, 'running', NOW())
            """), {
                "tenant_id": str(tenant_id),
                "company_id": str(company_id) if company_id else None,
                "environment_id": str(environment_id),
                "source_type": source_type,
                "snapshot_code": snapshot_code,
            })
            session.commit()

            try:
                rows = fetch_rows_from_protheus(tenant_id, source_type)
            except Exception as e:
                # Regra 2: Reporta falha explicitamente em vez de inventar dados de simulação
                session.execute(text("""
                    UPDATE tenant_dictionary_sources 
                    SET status = 'failed', finished_at = NOW(), error_message = :err
                    WHERE tenant_id = :tenant_id AND snapshot_code = :snapshot_code AND source_type = :source_type
                """), {
                    "tenant_id": str(tenant_id),
                    "snapshot_code": snapshot_code,
                    "source_type": source_type,
                    "err": str(e)
                })
                session.commit()
                raise e

            if source_type == "SX2":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_tables
                        (tenant_id, company_id, environment_id, snapshot_code, table_name, table_alias, module_code, description, physical_name, raw_payload)
                        VALUES (:tenant_id, :company_id, :environment_id, :snapshot_code, :table_name, :table_alias, :module_code, :description, :physical_name, CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name)
                        DO UPDATE SET table_alias = EXCLUDED.table_alias, module_code = EXCLUDED.module_code, description = EXCLUDED.description, physical_name = EXCLUDED.physical_name, raw_payload = EXCLUDED.raw_payload, updated_at = NOW()
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id), "snapshot_code": snapshot_code,
                        "table_name": str(r.get("X2_CHAVE") or r.get("table_name") or "").strip().upper(),
                        "table_alias": str(r.get("X2_ARQUIVO") or r.get("table_alias") or "").strip(),
                        "module_code": str(r.get("X2_MODULO") or r.get("module_code") or "").strip(),
                        "description": str(r.get("X2_NOME") or r.get("description") or "").strip(),
                        "physical_name": str(r.get("X2_ARQFIS") or r.get("physical_name") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })
            elif source_type == "SX3":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_fields
                        (tenant_id, company_id, environment_id, snapshot_code, table_name, field_name, title, field_type, length_num, decimal_num, required_flag, browse_flag, virtual_flag, validation_rule, relation_rule, when_rule, raw_payload)
                        VALUES (:tenant_id, :company_id, :environment_id, :snapshot_code, :table_name, :field_name, :title, :field_type, :length_num, :decimal_num, :required_flag, :browse_flag, :virtual_flag, :validation_rule, :relation_rule, :when_rule, CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name, field_name)
                        DO UPDATE SET title = EXCLUDED.title, field_type = EXCLUDED.field_type, length_num = EXCLUDED.length_num, decimal_num = EXCLUDED.decimal_num, required_flag = EXCLUDED.required_flag, browse_flag = EXCLUDED.browse_flag, virtual_flag = EXCLUDED.virtual_flag, validation_rule = EXCLUDED.validation_rule, relation_rule = EXCLUDED.relation_rule, when_rule = EXCLUDED.when_rule, raw_payload = EXCLUDED.raw_payload, updated_at = NOW()
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id), "snapshot_code": snapshot_code,
                        "table_name": str(r.get("X3_ARQUIVO") or r.get("table_name") or "").strip().upper(),
                        "field_name": str(r.get("X3_CAMPO") or r.get("field_name") or "").strip().upper(),
                        "title": str(r.get("X3_TITULO") or r.get("title") or "").strip(),
                        "field_type": str(r.get("X3_TIPO") or r.get("field_type") or "").strip(),
                        "length_num": int(r.get("X3_TAMANHO") or r.get("length_num") or 0) or None,
                        "decimal_num": int(r.get("X3_DECIMAL") or r.get("decimal_num") or 0) or None,
                        "required_flag": str(r.get("X3_OBRIGAT", "")).strip().upper() in ("S", "1", "T", "TRUE"),
                        "browse_flag": str(r.get("X3_VISUAL", "")).strip().upper() in ("S", "1", "T", "TRUE", "V"),
                        "virtual_flag": str(r.get("X3_CONTEXT", "")).strip().upper() == "V",
                        "validation_rule": str(r.get("X3_VALID") or r.get("validation_rule") or "").strip(),
                        "relation_rule": str(r.get("X3_RELACAO") or r.get("relation_rule") or "").strip(),
                        "when_rule": str(r.get("X3_WHEN") or r.get("when_rule") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })
            elif source_type == "SIX":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_indexes
                        (tenant_id, company_id, environment_id, snapshot_code, table_name, index_order, nickname, expression, raw_payload)
                        VALUES (:tenant_id, :company_id, :environment_id, :snapshot_code, :table_name, :index_order, :nickname, :expression, CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name, index_order)
                        DO UPDATE SET nickname = EXCLUDED.nickname, expression = EXCLUDED.expression, raw_payload = EXCLUDED.raw_payload
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id), "snapshot_code": snapshot_code,
                        "table_name": str(r.get("SIX_ARQUIVO") or r.get("table_name") or "").strip().upper(),
                        "index_order": str(r.get("SIX_ORDEM") or r.get("index_order") or "").strip(),
                        "nickname": str(r.get("SIX_DESCRIC") or r.get("nickname") or "").strip(),
                        "expression": str(r.get("SIX_CHAVE") or r.get("expression") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })
            elif source_type == "SXG":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_groups
                        (tenant_id, company_id, environment_id, snapshot_code, group_name, description, raw_payload)
                        VALUES (:tenant_id, :company_id, :environment_id, :snapshot_code, :group_name, :description, CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, snapshot_code, group_name)
                        DO UPDATE SET description = EXCLUDED.description, raw_payload = EXCLUDED.raw_payload
                    """), {
                        "tenant_id": str(tenant_id), "company_id": str(company_id) if company_id else None, "environment_id": str(environment_id), "snapshot_code": snapshot_code,
                        "group_name": str(r.get("XG_GRUPO") or r.get("group_name") or "").strip().upper(),
                        "description": str(r.get("XG_DESC") or r.get("description") or "").strip(),
                        "raw_payload": json.dumps(r)
                    })

            # Atualiza status para 'done'
            session.execute(text("""
                UPDATE tenant_dictionary_sources
                SET status = 'done', finished_at = NOW()
                WHERE tenant_id = :tenant_id AND snapshot_code = :snapshot_code AND source_type = :source_type
            """), {
                "tenant_id": str(tenant_id),
                "snapshot_code": snapshot_code,
                "source_type": source_type
            })
            session.commit()

        return {"snapshot_code": snapshot_code, "status": "done", "message": "Dicionário Protheus sincronizado com sucesso com dados reais."}
    except Exception as ex:
        session.rollback()
        raise ex
    finally:
        if own_session:
            session.close()

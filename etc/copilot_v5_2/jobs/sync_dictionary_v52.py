import os, uuid, requests
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")
PROTHEUS_REST_BASE = os.getenv("PROTHEUS_REST_BASE", "")
PROTHEUS_TOKEN = os.getenv("PROTHEUS_TOKEN", "")

SX_ENDPOINTS = {
    "SX2": "/api/framework/v1/query?table=SX2",
    "SX3": "/api/framework/v1/query?table=SX3",
    "SXG": "/api/framework/v1/query?table=SXG",
    "SIX": "/api/framework/v1/query?table=SIX",
}

def fetch_rows(source_type: str):
    url = f"{PROTHEUS_REST_BASE}{SX_ENDPOINTS[source_type]}"
    headers = {"Authorization": f"Bearer {PROTHEUS_TOKEN}"} if PROTHEUS_TOKEN else {}
    res = requests.get(url, headers=headers, timeout=60)
    res.raise_for_status()
    data = res.json()
    return data.get("items") or data.get("result") or data

def run_snapshot(tenant_id: str, environment_id: str, company_id: str | None = None, snapshot_code: str | None = None):
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL não informado")
    snapshot_code = snapshot_code or datetime.utcnow().strftime("%Y%m%d%H%M%S")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        for source_type in ["SX2","SX3","SXG","SIX"]:
            rows = fetch_rows(source_type)
            session.execute(text("""
                INSERT INTO tenant_dictionary_sources
                (tenant_id, company_id, environment_id, source_type, snapshot_code, status, started_at, finished_at)
                VALUES (:tenant_id, :company_id, :environment_id, :source_type, :snapshot_code, 'done', NOW(), NOW())
            """), {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "environment_id": environment_id,
                "source_type": source_type,
                "snapshot_code": snapshot_code,
            })
            if source_type == "SX2":
                for r in rows:
                    session.execute(text("""
                        INSERT INTO dictionary_tables
                        (tenant_id, company_id, environment_id, snapshot_code, table_name, table_alias, module_code, description, physical_name, raw_payload)
                        VALUES (:tenant_id, :company_id, :environment_id, :snapshot_code, :table_name, :table_alias, :module_code, :description, :physical_name, CAST(:raw_payload AS JSONB))
                        ON CONFLICT (tenant_id, environment_id, snapshot_code, table_name)
                        DO UPDATE SET table_alias = EXCLUDED.table_alias, module_code = EXCLUDED.module_code, description = EXCLUDED.description, physical_name = EXCLUDED.physical_name, raw_payload = EXCLUDED.raw_payload, updated_at = NOW()
                    """), {
                        "tenant_id": tenant_id, "company_id": company_id, "environment_id": environment_id, "snapshot_code": snapshot_code,
                        "table_name": r.get("X2_CHAVE") or r.get("table_name"),
                        "table_alias": r.get("X2_ARQUIVO"),
                        "module_code": r.get("X2_MODULO"),
                        "description": r.get("X2_NOME"),
                        "physical_name": r.get("X2_ARQFIS"),
                        "raw_payload": __import__('json').dumps(r)
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
                        "tenant_id": tenant_id, "company_id": company_id, "environment_id": environment_id, "snapshot_code": snapshot_code,
                        "table_name": r.get("X3_ARQUIVO") or r.get("table_name"),
                        "field_name": r.get("X3_CAMPO") or r.get("field_name"),
                        "title": r.get("X3_TITULO"),
                        "field_type": r.get("X3_TIPO"),
                        "length_num": int(r.get("X3_TAMANHO") or 0) or None,
                        "decimal_num": int(r.get("X3_DECIMAL") or 0) or None,
                        "required_flag": str(r.get("X3_OBRIGAT", "")).strip().upper() in ("S","1","T","TRUE"),
                        "browse_flag": str(r.get("X3_VISUAL", "")).strip().upper() in ("S","1","T","TRUE"),
                        "virtual_flag": str(r.get("X3_CONTEXT", "")).strip().upper() == "V",
                        "validation_rule": r.get("X3_VALID"),
                        "relation_rule": r.get("X3_RELACAO"),
                        "when_rule": r.get("X3_WHEN"),
                        "raw_payload": __import__('json').dumps(r)
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
                        "tenant_id": tenant_id, "company_id": company_id, "environment_id": environment_id, "snapshot_code": snapshot_code,
                        "table_name": r.get("SIX_ARQUIVO") or r.get("table_name"),
                        "index_order": str(r.get("SIX_ORDEM") or r.get("index_order")),
                        "nickname": r.get("SIX_DESCRIC"),
                        "expression": r.get("SIX_CHAVE"),
                        "raw_payload": __import__('json').dumps(r)
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
                        "tenant_id": tenant_id, "company_id": company_id, "environment_id": environment_id, "snapshot_code": snapshot_code,
                        "group_name": r.get("XG_GRUPO") or r.get("group_name"),
                        "description": r.get("XG_DESC") or r.get("description"),
                        "raw_payload": __import__('json').dumps(r)
                    })
        session.commit()
        return {"snapshot_code": snapshot_code, "status": "done"}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

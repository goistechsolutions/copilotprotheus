import json
import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import SessionLocal
from app.models.knowledge import (
    DictionarySnapshot, TenantDictionaryTable, TenantDictionaryField, 
    TenantDictionaryIndex, Tenant
)
from app.services.protheus_service import execute_protheus_tool

logger = logging.getLogger(__name__)

class DictionaryService:
    def __init__(self, db: Session):
        self.db = db

    def init_snapshot(self, tenant_id: str, company_id: str = None, env_id: str = None, user_id: str = None, snapshot_code: str = None):
        try:
            tid = uuid.UUID(tenant_id)
        except Exception:
            tenant = self.db.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
            if not tenant:
                raise ValueError("Tenant não encontrado")
            tid = tenant.id

        if not snapshot_code:
            snapshot_code = f"SYNC_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        
        snapshot = DictionarySnapshot(
            tenant_id=tid,
            company_id=uuid.UUID(company_id) if company_id else None,
            env_id=uuid.UUID(env_id) if env_id else None,
            snapshot_code=snapshot_code,
            snapshot_status='in_progress',
            requested_by=uuid.UUID(user_id) if user_id else None
        )
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        
        return snapshot

    async def run_sync_task(self, snapshot_id, tenant_id: str, modules: list = None):
        """
        Executa a extração em background. Usa uma nova sessão de banco de dados
        para evitar problemas com o fechamento da sessão da requisição HTTP original.
        """
        db = SessionLocal()
        try:
            snapshot = db.query(DictionarySnapshot).filter(DictionarySnapshot.id == snapshot_id).first()
            if not snapshot:
                return
            
            tid = snapshot.tenant_id

            # 1. Fetch SX2 (Tabelas)
            sx2_query = "SELECT X2_CHAVE, X2_NOME, X2_ARQUIVO, X2_TAMFIL, X2_MODO, X2_TAMUN, X2_MODOUN, X2_TAMEMP, X2_MODOEMP FROM SX2010 WHERE D_E_L_E_T_ = ' '"
            sx2_resp_str = await execute_protheus_tool("QueryRest", {"query": sx2_query}, tenant_id=tenant_id)
            sx2_data = self._parse_response(sx2_resp_str)
            
            tables_map = {}
            total_tables = 0
            if sx2_data:
                for row in sx2_data:
                    table_key = row.get("X2_CHAVE", "").strip()
                    phys_name = row.get("X2_ARQUIVO", "").strip()
                    if not table_key or not phys_name: continue
                    
                    t = TenantDictionaryTable(
                        snapshot_id=snapshot.id,
                        tenant_id=tid,
                        company_id=snapshot.company_id,
                        env_id=snapshot.env_id,
                        table_key=table_key,
                        physical_name=phys_name,
                        table_name=row.get("X2_NOME", "").strip(),
                        x2_tamfil=self._safe_num(row.get("X2_TAMFIL")),
                        x2_modo=row.get("X2_MODO", "").strip(),
                        x2_tamun=self._safe_num(row.get("X2_TAMUN")),
                        x2_modoun=row.get("X2_MODOUN", "").strip(),
                        x2_tamemp=self._safe_num(row.get("X2_TAMEMP")),
                        x2_modoemp=row.get("X2_MODOEMP", "").strip()
                    )
                    db.add(t)
                    db.commit()
                    db.refresh(t)
                    tables_map[phys_name] = t.id
                    total_tables += 1

            # 2. Fetch SX3 (Campos)
            sx3_query = "SELECT X3_ARQUIVO, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL, X3_TITULO, X3_DESCRI, X3_ORDEM, X3_AGRUP FROM SX3010 WHERE D_E_L_E_T_ = ' '"
            sx3_resp_str = await execute_protheus_tool("QueryRest", {"query": sx3_query}, tenant_id=tenant_id)
            sx3_data = self._parse_response(sx3_resp_str)
            
            total_fields = 0
            if sx3_data:
                for row in sx3_data:
                    arq = row.get("X3_ARQUIVO", "").strip()
                    table_id = tables_map.get(arq)
                    if not table_id: continue
                    
                    f = TenantDictionaryField(
                        snapshot_id=snapshot.id,
                        tenant_id=tid,
                        table_id=table_id,
                        field_name=row.get("X3_CAMPO", "").strip(),
                        field_description=row.get("X3_TITULO", row.get("X3_DESCRI", "")).strip(),
                        field_type=row.get("X3_TIPO", "").strip(),
                        field_length=self._safe_num(row.get("X3_TAMANHO")),
                        sxg_group=row.get("X3_AGRUP", "").strip()
                    )
                    db.add(f)
                    total_fields += 1
                db.commit()

            # 3. Fetch SIX (Índices)
            six_query = "SELECT X6_ARQUIVO, X6_ORDEM, X6_NOME, X6_CONTEUD FROM SIX010 WHERE D_E_L_E_T_ = ' '"
            six_resp_str = await execute_protheus_tool("QueryRest", {"query": six_query}, tenant_id=tenant_id)
            six_data = self._parse_response(six_resp_str)
            
            total_indexes = 0
            if six_data:
                for row in six_data:
                    arq = row.get("X6_ARQUIVO", "").strip()
                    table_id = tables_map.get(arq)
                    if not table_id: continue
                    
                    idx = TenantDictionaryIndex(
                        snapshot_id=snapshot.id,
                        tenant_id=tid,
                        table_id=table_id,
                        index_nickname=row.get("X6_NOME", "").strip(),
                        index_expression=row.get("X6_CONTEUD", "").strip()
                    )
                    db.add(idx)
                    total_indexes += 1
                db.commit()

            snapshot.snapshot_status = 'completed'
            snapshot.finished_at = datetime.now(timezone.utc)
            snapshot.total_tables = total_tables
            snapshot.total_fields = total_fields
            snapshot.total_indexes = total_indexes
            db.commit()
            
        except Exception as e:
            logger.error(f"Erro na sincronização de dicionário: {str(e)}")
            if 'snapshot' in locals() and snapshot:
                snapshot.snapshot_status = 'error'
                snapshot.notes = str(e)
                snapshot.finished_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()
            
    def _parse_response(self, resp_str: str):
        try:
            data = json.loads(resp_str)
            if isinstance(data, dict):
                if "items" in data:
                    return data["items"]
                elif "data" in data:
                    return data["data"]
            elif isinstance(data, list):
                return data
        except Exception:
            pass
        return []
        
    def _safe_num(self, val):
        try:
            return float(val)
        except Exception:
            return None

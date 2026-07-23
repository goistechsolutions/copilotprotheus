from sqlalchemy.orm import Session
from sqlalchemy import text

class KnowledgeCRUD:
    def __init__(self, db: Session):
        self.db = db

    def add_document(self, payload):
        q = text("""
            INSERT INTO documents (tenant_id, title, source_path, source_type, module, category, version, status, checksum, language, visibility)
            VALUES (:tenant_id, :title, :source_path, :source_type, :module, :category, :version, :status, :checksum, :language, :visibility)
            RETURNING id, created_at, updated_at
        """)
        return self.db.execute(q, payload).mappings().first()

    def list_documents(self, tenant_id: str, limit=100):
        q = text("SELECT * FROM documents WHERE (visibility = 'shared' OR (visibility = 'tenant' AND tenant_id = :tenant_id)) ORDER BY created_at DESC LIMIT :limit")
        return self.db.execute(q, {"tenant_id": tenant_id, "limit": limit}).mappings().all()

    def add_memory(self, payload):
        q = text("""
            INSERT INTO memories (tenant_id, memory_key, memory_value, memory_type, scope, tags, confidence, source, expires_at, visibility)
            VALUES (:tenant_id, :memory_key, :memory_value, :memory_type, :scope, :tags, :confidence, :source, :expires_at, :visibility)
            RETURNING id, created_at, updated_at
        """)
        return self.db.execute(q, payload).mappings().first()

    def list_memories(self, tenant_id: str, limit=100):
        q = text("SELECT * FROM memories WHERE (visibility = 'shared' OR (visibility = 'tenant' AND tenant_id = :tenant_id)) ORDER BY created_at DESC LIMIT :limit")
        return self.db.execute(q, {"tenant_id": tenant_id, "limit": limit}).mappings().all()

    def add_audit(self, payload):
        import uuid
        import json
        tenant_id = None
        try:
            if "tenant_id" in payload and payload["tenant_id"] and payload["tenant_id"] != "default":
                tenant_id = uuid.UUID(payload["tenant_id"])
        except Exception:
            pass
            
        module_name = payload.get("module", "rag")
        action_name = "query"
        details_json = json.dumps({
            "user_name": payload.get("user_name"),
            "session_id": payload.get("session_id"),
            "question": payload.get("question"),
            "answer": payload.get("answer"),
            "document_ids": payload.get("document_ids"),
            "memory_ids": payload.get("memory_ids"),
            "sql_used": payload.get("sql_used"),
            "rag_used": payload.get("rag_used")
        })

        q = text("""
            INSERT INTO audit_logs (tenant_id, module_name, action_name, details_json)
            VALUES (:tenant_id, :module_name, :action_name, cast(:details_json as jsonb))
            RETURNING id, created_at
        """)
        
        result = self.db.execute(q, {
            "tenant_id": tenant_id,
            "module_name": module_name,
            "action_name": action_name,
            "details_json": details_json
        }).mappings().first()
        self.db.commit()
        return result

    def list_audit(self, tenant_id: str, limit=100):
        import uuid
        try:
            tid = uuid.UUID(tenant_id)
        except Exception:
            return []
        q = text("SELECT * FROM audit_logs WHERE tenant_id = :tenant_id ORDER BY created_at DESC LIMIT :limit")
        return self.db.execute(q, {"tenant_id": tid, "limit": limit}).mappings().all()

    def delete_document(self, document_id: int, tenant_id: str):
        # Allow deletion if tenant_id matches, or if it's shared (in routes we will validate if the user can delete shared docs)
        q = text("DELETE FROM documents WHERE id = :document_id AND (tenant_id = :tenant_id OR visibility = 'shared') RETURNING id")
        result = self.db.execute(q, {"document_id": document_id, "tenant_id": tenant_id}).mappings().first()
        self.db.commit()
        return result

    def delete_memory(self, memory_id: int, tenant_id: str):
        q = text("DELETE FROM memories WHERE id = :memory_id AND (tenant_id = :tenant_id OR visibility = 'shared') RETURNING id")
        result = self.db.execute(q, {"memory_id": memory_id, "tenant_id": tenant_id}).mappings().first()
        self.db.commit()
        return result

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
        q = text("""
            INSERT INTO audit_logs (tenant_id, user_name, session_id, question, answer, module, document_ids, memory_ids, sql_used, rag_used)
            VALUES (:tenant_id, :user_name, :session_id, :question, :answer, :module, :document_ids, :memory_ids, :sql_used, :rag_used)
            RETURNING id, created_at
        """)
        return self.db.execute(q, payload).mappings().first()

    def list_audit(self, tenant_id: str, limit=100):
        q = text("SELECT * FROM audit_logs WHERE tenant_id = :tenant_id ORDER BY created_at DESC LIMIT :limit")
        return self.db.execute(q, {"tenant_id": tenant_id, "limit": limit}).mappings().all()

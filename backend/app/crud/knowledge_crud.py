from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


class KnowledgeStoreUnavailable(RuntimeError):
    """Indica que o schema tenant não possui uma estrutura RAG utilizável."""


class KnowledgeCRUD:
    _DOCUMENT_COLUMNS = (
        'id', 'tenant_id', 'visibility', 'title', 'source_path', 'source_type',
        'module', 'category', 'version', 'status', 'checksum', 'language',
        'created_at', 'updated_at', 'chunk_count',
    )

    def __init__(self, db: Session):
        self.db = db

    def _available_columns(self, table_name: str) -> tuple[str, set[str]]:
        try:
            schema = self.db.execute(text('SELECT current_schema()')).scalar()
            rows = self.db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = :table_name
                    """
                ),
                {'table_name': table_name},
            ).scalars().all()
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise KnowledgeStoreUnavailable('Não foi possível inspecionar o schema RAG autorizado.') from exc
        return str(schema or ''), {str(row) for row in rows}

    def _document_projection(self) -> tuple[str, str]:
        schema, columns = self._available_columns('documents')
        required = {'id', 'tenant_id', 'visibility'}
        if not schema or not required.issubset(columns):
            raise KnowledgeStoreUnavailable('A tabela documents não está disponível com as colunas mínimas no schema autorizado.')

        selected = [column for column in self._DOCUMENT_COLUMNS if column in columns and column != 'chunk_count']
        projection = ', '.join(f'"{column}"' for column in selected)
        order_by = '"created_at" DESC NULLS LAST, "id" DESC' if 'created_at' in columns else '"id" DESC'
        return projection, order_by

    def add_document(self, payload):
        q = text("""
            INSERT INTO documents (tenant_id, title, source_path, source_type, module, category, version, status, checksum, language, visibility)
            VALUES (:tenant_id, :title, :source_path, :source_type, :module, :category, :version, :status, :checksum, :language, :visibility)
            RETURNING id, created_at, updated_at
        """)
        return self.db.execute(q, payload).mappings().first()

    def list_documents(self, tenant_id: str, limit=100):
        projection, order_by = self._document_projection()
        query = text(
            f'SELECT {projection} FROM "documents" '
            'WHERE ("visibility" = \'shared\' OR ("visibility" = \'tenant\' AND "tenant_id" = :tenant_id)) '
            f'ORDER BY {order_by} LIMIT :limit'
        )
        try:
            return self.db.execute(query, {'tenant_id': tenant_id, 'limit': limit}).mappings().all()
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise KnowledgeStoreUnavailable('A consulta da base RAG falhou no schema autorizado.') from exc

    def add_memory(self, payload):
        q = text("""
            INSERT INTO memories (tenant_id, memory_key, memory_value, memory_type, scope, tags, confidence, source, expires_at, visibility)
            VALUES (:tenant_id, :memory_key, :memory_value, :memory_type, :scope, :tags, :confidence, :source, :expires_at, :visibility)
            RETURNING id, created_at, updated_at
        """)
        return self.db.execute(q, payload).mappings().first()

    def list_memories(self, tenant_id: str, limit=100):
        q = text("SELECT * FROM memories WHERE (visibility = 'shared' OR (visibility = 'tenant' AND tenant_id = :tenant_id)) ORDER BY created_at DESC LIMIT :limit")
        return self.db.execute(q, {'tenant_id': tenant_id, 'limit': limit}).mappings().all()

    def add_audit(self, payload):
        import json
        import uuid

        tenant_id = None
        try:
            if payload.get('tenant_id') and payload['tenant_id'] != 'default':
                tenant_id = payload['tenant_id']
        except Exception:
            pass

        details_json = json.dumps({
            'user_name': payload.get('user_name'),
            'session_id': payload.get('session_id'),
            'question': payload.get('question'),
            'answer': payload.get('answer'),
            'document_ids': payload.get('document_ids'),
            'memory_ids': payload.get('memory_ids'),
            'sql_used': payload.get('sql_used'),
            'rag_used': payload.get('rag_used'),
        })
        q = text("""
            INSERT INTO audit_logs (tenant_id, module_name, action_name, details_json)
            VALUES (:tenant_id, :module_name, :action_name, cast(:details_json as jsonb))
            RETURNING id, created_at
        """)
        result = self.db.execute(q, {
            'tenant_id': tenant_id,
            'module_name': payload.get('module', 'rag'),
            'action_name': 'query',
            'details_json': details_json,
        }).mappings().first()
        self.db.commit()
        return result

    def list_audit(self, tenant_id: str, limit=100):
        tid = tenant_id
        q = text('SELECT * FROM audit_logs WHERE tenant_id = :tenant_id ORDER BY created_at DESC LIMIT :limit')
        return self.db.execute(q, {'tenant_id': tid, 'limit': limit}).mappings().all()

    def delete_document(self, document_id: int, tenant_id: str):
        q = text('DELETE FROM documents WHERE id = :document_id AND (tenant_id = :tenant_id OR visibility = \'shared\') RETURNING id')
        result = self.db.execute(q, {'document_id': document_id, 'tenant_id': tenant_id}).mappings().first()
        self.db.commit()
        return result

    def delete_memory(self, memory_id: int, tenant_id: str):
        q = text('DELETE FROM memories WHERE id = :memory_id AND (tenant_id = :tenant_id OR visibility = \'shared\') RETURNING id')
        result = self.db.execute(q, {'memory_id': memory_id, 'tenant_id': tenant_id}).mappings().first()
        self.db.commit()
        return result

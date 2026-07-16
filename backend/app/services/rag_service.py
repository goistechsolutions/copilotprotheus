from sqlalchemy.orm import Session
from sqlalchemy import text

class RAGService:
    def __init__(self, db: Session):
        self.db = db

    def _get_embedding(self, text: str):
        import httpx
        import os
        url = os.getenv("OLLAMA_URL", "")
        model = os.getenv("OLLAMA_MODEL", "llama3")
        try:
            with httpx.Client(timeout=600.0) as client:
                res = client.post(f"{url}/api/embeddings", json={"model": model, "prompt": text, "keep_alive": 0})
                res.raise_for_status()
                return res.json().get("embedding")
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return None

    def search(self, question: str, tenant_id: str, limit: int = 4):
        vec = self._get_embedding(question)
        if not vec:
            # Fallback para busca por texto
            tokens = [t.lower() for t in question.split() if len(t) > 2]
            if not tokens:
                return []
            like_clauses = ' OR '.join(['LOWER(dc.content) LIKE :t%d' % i for i in range(len(tokens))])
            q = text(f"""
                SELECT d.title, d.source_path, dc.page_number, dc.content
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                WHERE d.tenant_id = :tenant_id AND ({like_clauses})
                ORDER BY dc.created_at DESC
                LIMIT :limit
            """)
            params = {f't{i}': f'%{tok}%' for i, tok in enumerate(tokens)}
            params['tenant_id'] = tenant_id
            params['limit'] = limit
            return self.db.execute(q, params).mappings().all()

        # Busca Vetorial usando Cosine Distance (<=>)
        q = text("""
            SELECT d.title, d.source_path, dc.page_number, dc.content
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.vector IS NOT NULL AND d.tenant_id = :tenant_id
            ORDER BY dc.vector <=> :embedding
            LIMIT :limit
        """)
        params = {'embedding': str(vec), 'tenant_id': tenant_id, 'limit': limit}
        rows = self.db.execute(q, params).mappings().all()
        return rows

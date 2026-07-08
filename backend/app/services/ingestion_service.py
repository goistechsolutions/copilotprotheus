from pathlib import Path
from pypdf import PdfReader
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.crud.knowledge_crud import KnowledgeCRUD
from app.rag.chunker import chunk_text

DOCS_DIR = Path(r"C:\projeto\copilotprotheus\docs")

class IngestionService:
    def __init__(self, db: Session):
        self.db = db
        self.crud = KnowledgeCRUD(db)

    def checksum_file(self, path: Path):
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()

    def _get_embedding(self, text: str):
        import httpx
        import os
        url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3")
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{url}/api/embeddings", json={"model": model, "prompt": text})
                res.raise_for_status()
                return res.json().get("embedding")
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return None

    def extract_text(self, path: Path):
        if path.suffix.lower() == '.pdf':
            reader = PdfReader(str(path))
            pages = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ''
                if txt.strip():
                    pages.append({'page': i + 1, 'text': txt})
            return pages
        if path.suffix.lower() in ['.txt', '.md', '.html']:
            return [{'page': 1, 'text': path.read_text(encoding='utf-8', errors='ignore')}]
        return []

    def ingest(self, tenant_id: str):
        result = {'documents': 0, 'chunks': 0, 'errors': []}
        if not DOCS_DIR.exists():
            return result
        for path in DOCS_DIR.rglob('*'):
            if path.is_file() and path.suffix.lower() in ['.pdf', '.txt', '.md', '.html']:
                try:
                    checksum = self.checksum_file(path)
                    existing = self.db.execute(text("SELECT id FROM documents WHERE checksum = :checksum"), {"checksum": checksum}).mappings().first()
                    if existing:
                        continue
                    doc = self.crud.add_document({
                        'tenant_id': tenant_id,
                        'title': path.stem,
                        'source_path': str(path),
                        'source_type': 'file',
                        'module': None,
                        'category': None,
                        'version': None,
                        'status': 'active',
                        'checksum': checksum,
                        'language': 'pt-BR'
                    })
                    if not doc:
                        continue
                    result['documents'] += 1
                    extracted = self.extract_text(path)
                    for item in extracted:
                        chunks = chunk_text(item['text'])
                        for idx, chunk in enumerate(chunks):
                            vec = self._get_embedding(chunk)
                            if not vec:
                                continue
                            self.db.execute(text("""
                                INSERT INTO document_chunks (document_id, chunk_order, content, token_count, embedding_model, vector, page_number, section)
                                VALUES (:document_id, :chunk_order, :content, :token_count, :embedding_model, :vector, :page_number, :section)
                            """), {
                                'document_id': doc['id'],
                                'chunk_order': idx,
                                'content': chunk,
                                'token_count': len(chunk.split()),
                                'embedding_model': 'llama3',
                                'vector': str(vec),
                                'page_number': item['page'],
                                'section': None
                            })
                            result['chunks'] += 1
                    self.db.commit()
                except Exception as e:
                    self.db.rollback()
                    result['errors'].append(f'{path}: {e}')
        return result

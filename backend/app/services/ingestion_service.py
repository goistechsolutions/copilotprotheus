from pathlib import Path
from pypdf import PdfReader
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.crud.knowledge_crud import KnowledgeCRUD
from app.rag.chunker import chunk_text

# Diretórios base para documentos compartilhados e por tenant
BASE_DOCS_DIR = Path("./docs")
SHARED_DOCS_DIR = BASE_DOCS_DIR / "shared"
TENANTS_DOCS_DIR = BASE_DOCS_DIR / "tenants"

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
        url = os.getenv("OLLAMA_URL", "")
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

    def _get_docs_dir(self, tenant_id: str, visibility: str) -> Path:
        """Retorna o diretório correto baseado no tenant e visibilidade."""
        if visibility == 'shared':
            return SHARED_DOCS_DIR
        return TENANTS_DOCS_DIR / tenant_id

    def ingest(self, tenant_id: str, visibility: str = 'tenant'):
        from app.services.r2_client import R2Client
        import tempfile
        import os
        
        result = {'documents': 0, 'chunks': 0, 'errors': []}
        r2 = R2Client()
        prefix = 'shared/' if visibility == 'shared' else f'tenants/{tenant_id}/'
        
        files = r2.list_files_by_prefix(prefix)
        if not files:
            return result
            
        for object_name in files:
            ext = Path(object_name).suffix.lower()
            if ext not in ['.pdf', '.txt', '.md', '.html']:
                continue
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp_path = Path(tmp.name)
            
            try:
                success = r2.download_file(object_name, str(tmp_path))
                if not success:
                    raise Exception(f"Failed to download {object_name} from R2")
                    
                checksum = self.checksum_file(tmp_path)
                existing = self.db.execute(text("SELECT id FROM documents WHERE checksum = :checksum"), {"checksum": checksum}).mappings().first()
                if existing:
                    os.remove(str(tmp_path))
                    continue
                    
                title = Path(object_name).stem
                doc = self.crud.add_document({
                    'tenant_id': tenant_id,
                    'title': title,
                    'source_path': f"r2://{object_name}",
                    'source_type': 'file',
                    'module': None,
                    'category': None,
                    'version': None,
                    'status': 'active',
                    'checksum': checksum,
                    'language': 'pt-BR',
                    'visibility': visibility
                })
                
                if not doc:
                    os.remove(str(tmp_path))
                    continue
                    
                result['documents'] += 1
                extracted = self.extract_text(tmp_path)
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
                os.remove(str(tmp_path))
                
            except Exception as e:
                self.db.rollback()
                result['errors'].append(f'{object_name}: {e}')
                if tmp_path.exists():
                    os.remove(str(tmp_path))
                    
        return result

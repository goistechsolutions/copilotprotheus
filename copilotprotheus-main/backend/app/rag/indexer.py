import json
from pathlib import Path
from app.rag.chunker import chunk_text

INDEX_FILE = Path(__file__).resolve().parent / "chunks" / "rag_index.json"
INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)

def build_index(documents):
    items = []
    for doc in documents:
        for idx, chunk in enumerate(chunk_text(doc["text"])):
            items.append({
                "source": doc["source"],
                "page": doc.get("page", 1),
                "chunk_id": idx,
                "text": chunk
            })
    INDEX_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return items

def load_index():
    if not INDEX_FILE.exists():
        return []
    return json.loads(INDEX_FILE.read_text(encoding="utf-8"))

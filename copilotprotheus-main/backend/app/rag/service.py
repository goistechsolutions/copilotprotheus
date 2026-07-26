from app.rag.document_loader import load_documents
from app.rag.indexer import build_index
from app.rag.config import DOCS_DIR
from app.rag.retriever import retrieve

def rebuild_rag():
    docs = load_documents(DOCS_DIR)
    return build_index(docs)

def answer_with_rag(question):
    chunks = retrieve(question)
    if not chunks:
        return None, []
    context = "\n\n".join(
        f"[Fonte: {c['source']} | Página: {c['page']}] {c['text'][:700]}"
        for c in chunks
    )
    return context, chunks

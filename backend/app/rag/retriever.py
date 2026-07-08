from app.rag.indexer import load_index

def retrieve(query, top_k=4):
    items = load_index()
    query_tokens = set(query.lower().split())
    scored = []
    for item in items:
        text = item["text"].lower()
        score = sum(1 for t in query_tokens if t in text)
        if score > 0:
            scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:top_k]]

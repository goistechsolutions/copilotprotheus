from pathlib import Path
from pypdf import PdfReader

def load_documents(docs_dir: Path):
    texts = []
    if not docs_dir.exists():
        return texts
    for path in docs_dir.rglob("*"):
        if path.suffix.lower() == ".pdf":
            try:
                reader = PdfReader(str(path))
                for i, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if text.strip():
                        texts.append({"source": str(path), "page": i + 1, "text": text})
            except Exception:
                continue
        elif path.suffix.lower() in [".txt", ".md"]:
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
                if text.strip():
                    texts.append({"source": str(path), "page": 1, "text": text})
            except Exception:
                continue
    return texts

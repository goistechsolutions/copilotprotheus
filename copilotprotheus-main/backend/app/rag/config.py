from pathlib import Path
DOCS_DIR = Path(r"D:\copilotprotheus\docs")
CHUNKS_DIR = Path(__file__).resolve().parent / "chunks"
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

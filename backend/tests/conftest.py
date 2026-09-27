import os

os.environ.setdefault("JWT_SECRET", "x" * 32)
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://user:pass@localhost:5432/testdb")

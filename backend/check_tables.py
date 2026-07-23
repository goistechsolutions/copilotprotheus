import os
from sqlalchemy import create_engine, text

# Set environment variable if missing
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/copilot_protheus"

try:
    from app.db.database import engine
except ImportError:
    engine = create_engine(os.environ["DATABASE_URL"])

with engine.connect() as conn:
    schemas_res = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog');"))
    schemas = [row[0] for row in schemas_res]
    
    for schema in schemas:
        if schema.startswith('pg_'): continue
        print(f"\\n=== Schema: {schema} ===")
        tables_res = conn.execute(text(f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{schema}'"))
        tables = [row[0] for row in tables_res]
        if not tables:
            print("  (Nenhuma tabela encontrada)")
        for table in tables:
            print(f"  - {table}")
            
            # Count rows for important tables
            if table in ('protheus_modules', 'tenant_schemas'):
                try:
                    count_res = conn.execute(text(f'SELECT COUNT(*) FROM "{schema}".{table}'))
                    count = count_res.scalar()
                    print(f"    (Linhas: {count})")
                except Exception as e:
                    print(f"    (Erro ao contar: {e})")

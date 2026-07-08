from app.db.database import SessionLocal
from app.models.knowledge import Company

db = SessionLocal()
comps = db.query(Company).all()
for c in comps:
    print(f"ID: {c.id}, CNPJ: {c.cnpj}, Razao: {c.razao_social}, Grupo: {c.protheus_grupo}, Usuario: {c.protheus_usuario}, Filial: {c.protheus_filial}, Licenca: {c.licenca_uso[:20] if c.licenca_uso else 'None'}")
db.close()

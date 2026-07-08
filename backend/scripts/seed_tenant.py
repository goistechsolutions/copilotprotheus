import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the root directory to path to import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db.database import Base, engine
from app.models.knowledge import Tenant
from app.core.security import encrypt_password
from app.core.config import settings

def seed_tenant():
    # Garantir que a tabela tenants existe
    print("Verificando se a tabela 'tenants' existe...")
    Base.metadata.create_all(bind=engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    tenant_id = settings.tenant_name
    print(f"Buscando tenant piloto: {tenant_id}...")
    
    tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        print(f"Criando registro de tenant piloto '{tenant_id}'...")
        encrypted_pass = encrypt_password(settings.protheus_password)
        
        tenant = Tenant(
            id=tenant_id,
            name="RODOL Ltda - Piloto Comercial",
            protheus_rest_url=settings.protheus_rest_url,
            protheus_user=settings.protheus_user,
            encrypted_protheus_password=encrypted_pass,
            auth_mode=settings.auth_mode
        )
        session.add(tenant)
        session.commit()
        print(f"Tenant '{tenant_id}' cadastrado com sucesso no banco de dados!")
    else:
        print(f"Tenant '{tenant_id}' ja existe no banco. Atualizando credenciais...")
        tenant.protheus_rest_url = settings.protheus_rest_url
        tenant.protheus_user = settings.protheus_user
        tenant.encrypted_protheus_password = encrypt_password(settings.protheus_password)
        tenant.auth_mode = settings.auth_mode
        session.commit()
        print(f"Credenciais do tenant '{tenant_id}' atualizadas com sucesso!")
        
    session.close()

if __name__ == "__main__":
    seed_tenant()

import os
import sys
from datetime import datetime, timedelta

# Adicionar raiz do backend ao path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import engine, SessionLocal, Base
from app.models.knowledge import Company
from app.services.license_service import generate_license

def seed_pilot_company():
    print("-> Verificando conexao com o banco e criando tabelas...")
    Base.metadata.create_all(bind=engine)
    
    session = SessionLocal()
    try:
        # Procurar se a empresa demonstrativa / piloto já existe
        pilot_grupo = "cliente_alpha"
        cnpj = "12345678000199"
        
        # Gerar licenca de 10 anos para demonstração
        exp_date = (datetime.now() + timedelta(days=3650)).strftime("%Y-%m-%d")
        print(f"-> Gerando licenca valida para o CNPJ {cnpj} ate {exp_date}...")
        license_token = generate_license(cnpj=cnpj, expiration_date=exp_date, plan_level="premium")
        
        comp = session.query(Company).filter(Company.protheus_grupo == pilot_grupo).first()
        if not comp:
            print("-> Cadastrando empresa demonstrativa 'Cliente Alpha Tecnologia S/A'...")
            comp = Company(
                cnpj=cnpj,
                ie="110220330",
                razao_social="Cliente Alpha Tecnologia S/A",
                email="contato@empresa-alpha.com.br",
                telefone="1133445566",
                endereco="Av. Paulista, 1000 - Sao Paulo/SP",
                protheus_grupo=pilot_grupo,
                protheus_filial="0101",
                protheus_ambientes="producao",
                protheus_rest_url="https://protheus.alpha.cloudtotvs.com.br:10707/rest",
                protheus_webapp_url="https://protheus.alpha.cloudtotvs.com.br:10703/webapp/index.html",
                licenca_uso=license_token
            )
            session.add(comp)
        else:
            print("-> Empresa demonstrativa encontrada. Atualizando token de licenca e URLs...")
            comp.licenca_uso = license_token
            comp.cnpj = cnpj
            comp.protheus_rest_url = "https://protheus.alpha.cloudtotvs.com.br:10707/rest"
            comp.protheus_webapp_url = "https://protheus.alpha.cloudtotvs.com.br:10703/webapp/index.html"
            
        session.commit()
        print(f"[OK] Empresa demonstrativa semeada com sucesso! Código único: {comp.id}")
    except Exception as e:
        session.rollback()
        print(f"[ERRO] Falha ao semear empresa piloto: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    seed_pilot_company()

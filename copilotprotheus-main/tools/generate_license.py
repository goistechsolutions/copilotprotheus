import sys
import jwt
from datetime import datetime

def main():
    print("=== Gerador de Licencas Copilot Protheus ===")
    jwt_secret = input("Digite o JWT_SECRET do seu backend: ").strip()
    if not jwt_secret:
        print("Erro: JWT_SECRET nao pode ser vazio.")
        sys.exit(1)
        
    cnpj = input("Digite o CNPJ do cliente (apenas numeros): ").strip()
    if not cnpj:
        print("Erro: CNPJ nao pode ser vazio.")
        sys.exit(1)
        
    expiration_date = input("Digite a data de expiracao (formato YYYY-MM-DD): ").strip()
    try:
        dt = datetime.strptime(expiration_date, "%Y-%m-%d")
    except ValueError:
        print("Erro: Data de expiracao invalida. Use o formato YYYY-MM-DD.")
        sys.exit(1)
        
    plan_level = input("Digite o plano (standard/premium/gold/enterprise) [standard]: ").strip().lower()
    if not plan_level:
        plan_level = "standard"
        
    license_secret = jwt_secret + "-license-key-salt"
    
    payload = {
        "cnpj": cnpj,
        "exp": int(dt.timestamp()),
        "plan_level": plan_level,
        "generated_at": datetime.now().isoformat()
    }
    
    token = jwt.encode(payload, license_secret, algorithm="HS256")
    print("\n✅ Licenca gerada com sucesso!")
    print(f"Token JWT da Licenca:\n\n{token}\n")

if __name__ == "__main__":
    main()

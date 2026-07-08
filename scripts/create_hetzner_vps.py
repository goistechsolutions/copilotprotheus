import json
import urllib.request
import urllib.error
import subprocess
import time
import sys
import os

API_TOKEN = "EOcKSD8dmnGrUYKhBp97ojoD4ibz5zJCiusUBOIm1bbDcnQaDwf448dc4ShhNKil"
KEY_NAME = "copilot_key"
PRIVATE_KEY_PATH = r"C:\projeto\copilotprotheus\key\copilot_key.pem"
BASE_URL = "https://api.hetzner.cloud/v1"

def extract_public_key():
    print("-> Extraindo chave publica da chave privada local...")
    try:
        res = subprocess.run(
            ["ssh-keygen", "-y", "-f", PRIVATE_KEY_PATH],
            capture_output=True,
            text=True,
            check=True
        )
        return res.stdout.strip()
    except Exception as e:
        print(f"Erro ao extrair chave publica: {e}")
        sys.exit(1)

def hetzner_request(endpoint, method="GET", body=None):
    url = f"{BASE_URL}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"Erro na API da Hetzner ({e.code}): {err_msg}")
        return None
    except Exception as e:
        print(f"Erro de conexao: {e}")
        return None

def main():
    public_key = extract_public_key()
    
    # 1. Verificar se a chave SSH já existe na Hetzner
    print("-> Verificando chaves SSH existentes...")
    ssh_keys_resp = hetzner_request("ssh_keys")
    if not ssh_keys_resp:
        print("Falha ao obter chaves SSH.")
        sys.exit(1)
        
    ssh_key_id = None
    for key in ssh_keys_resp.get("ssh_keys", []):
        if key.get("name") == KEY_NAME:
            ssh_key_id = key.get("id")
            print(f"-> Chave SSH '{KEY_NAME}' ja existe com ID {ssh_key_id}.")
            break
            
    # 2. Criar a chave SSH se não existir
    if not ssh_key_id:
        print(f"-> Cadastrando chave SSH '{KEY_NAME}' na Hetzner...")
        create_key_body = {
            "name": KEY_NAME,
            "public_key": public_key
        }
        create_resp = hetzner_request("ssh_keys", method="POST", body=create_key_body)
        if not create_resp:
            print("Falha ao cadastrar chave SSH.")
            sys.exit(1)
        ssh_key_id = create_resp.get("ssh_key", {}).get("id")
        print(f"-> Chave SSH cadastrada com sucesso! ID: {ssh_key_id}")
        
    # 3. Criar a VM (Server)
    print("-> Solicitando criacao da VM CX22 (Ubuntu 22.04, Ashburn-EUA) na Hetzner...")
    create_server_body = {
        "name": "copilot-protheus-vps",
        "server_type": "cpx21",
        "image": "ubuntu-22.04",
        "location": "ash",
        "ssh_keys": [ssh_key_id]
    }
    
    server_resp = hetzner_request("servers", method="POST", body=create_server_body)
    if not server_resp:
        print("Falha ao criar o servidor.")
        sys.exit(1)
        
    server_id = server_resp.get("server", {}).get("id")
    print(f"-> Servidor criado com sucesso! ID: {server_id}. Aguardando inicializacao...")
    
    # 4. Aguardar o servidor ficar ativo e obter o IP público
    public_ip = None
    while not public_ip:
        time.sleep(3)
        status_resp = hetzner_request(f"servers/{server_id}")
        if not status_resp:
            continue
            
        server_info = status_resp.get("server", {})
        status = server_info.get("status")
        print(f"   Status atual: {status}...")
        
        if status == "running":
            public_ip = server_info.get("public_net", {}).get("ipv4", {}).get("ip")
            if public_ip:
                break
                
    print(f"\n========================================================")
    print(f"[OK] VM DA HETZNER CRIADA E ATIVA!")
    print(f"IP Publico: {public_ip}")
    print(f"Usuario: root")
    print(f"Chave de Acesso: {PRIVATE_KEY_PATH}")
    print(f"========================================================\n")
    
    # Salvar o IP no arquivo vps_ip.txt
    with open(r"C:\projeto\copilotprotheus\scripts\vps_ip.txt", "w") as f:
        f.write(public_ip)
        
    # Explicar comando para o usuário conectar
    print(f"Para conectar na VM, abra um novo PowerShell e rode:")
    print(f"ssh -i \"{PRIVATE_KEY_PATH}\" root@{public_ip}")

if __name__ == "__main__":
    main()

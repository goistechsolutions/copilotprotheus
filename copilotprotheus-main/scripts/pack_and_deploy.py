import zipfile
import subprocess
import os
import sys

VPS_IP = "5.161.216.50"
PRIVATE_KEY = r"C:\projeto\copilotprotheus\key\copilot_key.pem"
ZIP_FILE_PATH = r"C:\projeto\copilotprotheus\deploy.zip"
PROJECT_ROOT = r"C:\projeto\copilotprotheus"

# Pastas e arquivos a serem ignorados no zip
EXCLUDE_DIRS = {
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".pytest_cache",
    "tmp",
    "dist"
}

EXCLUDE_FILES = {
    "deploy.zip",
    "desktop.ini",
    "backend.log"
}

def build_zip():
    print("-> Compactando arquivos do projeto (excluindo venv, node_modules, etc.)...")
    with zipfile.ZipFile(ZIP_FILE_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Modifica a lista dirs in-place para impedir o os.walk de entrar em pastas excluidas
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if file in EXCLUDE_FILES or file.endswith(".pyc") or file.endswith(".log"):
                    continue
                    
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, PROJECT_ROOT)
                zipf.write(full_path, rel_path)
                
    zip_size_mb = os.path.getsize(ZIP_FILE_PATH) / (1024 * 1024)
    print(f"-> Arquivo de deploy gerado: deploy.zip ({zip_size_mb:.2f} MB)")

def deploy_to_vps():
    ssh_opts = ["-o", "StrictHostKeyChecking=no", "-i", PRIVATE_KEY]
    
    # 1. Instalar unzip na VM caso nao esteja instalado
    print("-> Instalando 'unzip' na VM...")
    subprocess.run(["ssh"] + ssh_opts + [f"root@{VPS_IP}", "apt-get update && apt-get install -y unzip"], check=True)
    
    # 2. Copiar o zip para o /tmp da VM
    print("-> Enviando deploy.zip para a VM...")
    subprocess.run(["scp"] + ssh_opts + [ZIP_FILE_PATH, f"root@{VPS_IP}:/tmp/deploy.zip"], check=True)
    
    # 3. Extrair os arquivos na pasta /root/copilotprotheus
    print("-> Extraindo arquivos na VM em /root/copilotprotheus...")
    remote_commands = (
        "mkdir -p /root/copilotprotheus && "
        "unzip -o /tmp/deploy.zip -d /root/copilotprotheus && "
        "rm -f /tmp/deploy.zip"
    )
    subprocess.run(["ssh"] + ssh_opts + [f"root@{VPS_IP}", remote_commands], check=True)
    print("-> Deploy concluido com sucesso na VM!")

def main():
    try:
        build_zip()
        deploy_to_vps()
        
        # Limpar zip local
        if os.path.exists(ZIP_FILE_PATH):
            os.remove(ZIP_FILE_PATH)
            
    except Exception as e:
        print(f"Erro durante o deploy: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

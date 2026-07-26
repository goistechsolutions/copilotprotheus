# Copilot Protheus - Pacote de Implantação Windows

Este pacote contém backend, frontend e scripts PowerShell para implantação local no Windows.

## Estrutura
- backend/
- frontend/
- scripts/
- docs/

## Pré-requisitos
- Python 3.11+ instalado e disponível no PATH
- Node.js 20+ instalado e disponível no PATH
- PowerShell 5.1+
- Protheus homologação com REST habilitado

## Passos
1. Extraia a pasta em um diretório, ex.: `C:\projeto\copilotprotheus`
2. Edite `backend\.env` se necessário; se não existir, o script cria a partir do `.env.example`
3. Abra PowerShell na raiz do projeto
4. Execute backend:
   `./scripts/start_backend.ps1`
5. Em outro terminal PowerShell, execute frontend:
   `./scripts/start_frontend.ps1`

## Validações
- Backend: http://127.0.0.1:8000/health
- Catálogo: http://127.0.0.1:8000/api/catalog
- Diagnóstico Protheus: http://127.0.0.1:8000/api/diagnostics/protheus
- Frontend: http://localhost:5173

## Observações
- O backend trabalha com catálogo SQL homologado por módulo.
- O frontend consome o backend local por padrão.
- Ajuste `PROTHEUS_REST_URL` no arquivo `.env` para apontar ao REST do seu Protheus.

# Fase 4 — Secrets & Variáveis de Ambiente

Configure os secrets abaixo no repositório GitHub:
**Settings → Secrets and variables → Actions**

## CI/CD — Deploy Admin (Cloudflare Pages)

| Secret | Descrição |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token CF com permissão `Cloudflare Pages: Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `VITE_API_URL` | URL pública da API backend (ex: `https://api.copilotprotheus.com`) |

## CI/CD — Deploy Backend (VPS)

| Secret | Descrição |
|---|---|
| `VPS_HOST` | IP ou hostname do servidor |
| `VPS_USER` | Usuário SSH (ex: `ubuntu`) |
| `VPS_SSH_KEY` | Chave privada SSH (RSA ou Ed25519) |
| `VPS_PORT` | Porta SSH (padrão: 22) |

## Power BI (backend .env)

| Variável | Descrição |
|---|---|
| `POWERBI_TENANT_ID` | Tenant ID do Azure AD |
| `POWERBI_CLIENT_ID` | App Registration Client ID |
| `POWERBI_CLIENT_SECRET` | App Registration Client Secret |

## Leonardo AI (backend .env)

| Variável | Descrição |
|---|---|
| `LEONARDO_API_KEY` | API Key da conta Leonardo AI |
| `LEONARDO_MODEL_ID` | Model ID (default: Leonardo Phoenix) |

## Como criar o projeto no Cloudflare Pages

```bash
# 1. Acesse: https://dash.cloudflare.com → Pages → Create a project
# 2. Conecte o repositório GitHub
# 3. Configure:
#    Build command:    npm run build
#    Build output dir: dist
#    Root directory:   admin-frontend
# 4. Adicione variável de ambiente:
#    VITE_API_URL = https://api.copilotprotheus.com
# 5. Salve — o workflow GitHub Actions fará deploys automáticos
```

## Como configurar o Power BI Service Principal

```
1. Azure Portal → App Registrations → New registration
2. Client Secret → New client secret → copiar valor
3. Power BI Admin → Tenant Settings → "Allow service principals to use Power BI APIs" = ON
4. Workspace → Settings → Access → adicionar service principal como Member
```

# Cloudflare Tunnel — Configuração Completa

Guia para expor a API do CopilotProtheus via Cloudflare Tunnel (Zero Trust)  
sem abrir portas no firewall da VPS Hetzner.

---

## Arquitetura

```
Usuário/Browser
     │
     ▼
Cloudflare Edge (HTTPS/TLS automático)
     │  Cloudflare Tunnel (cloudflared)
     ▼
VPS Hetzner
  └── Docker Network (interna)
        ├── cloudflared     → conecta ao edge
        ├── fastapi-backend → porta 8000 (interna)
        ├── postgres        → porta 5432 (interna — nunca exposta)
        └── frontend        → porta 3000 (interna)
```

**Regra de ouro:** PostgreSQL NUNCA fica acessível externamente.  
Apenas a API FastAPI recebe tráfego via túnel.

---

## Passo 1 — Criar o Túnel no Cloudflare Zero Trust

1. Acesse [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. Vá em **Networks → Tunnels → Create a tunnel**
3. Escolha **Cloudflared** como conector
4. Nomeie o túnel: `copilotprotheus-prod`
5. Copie o **token** gerado — salve no GitHub Secret `CLOUDFLARE_TUNNEL_TOKEN`

---

## Passo 2 — Configurar o docker-compose.yml

Adicione o serviço `cloudflared` ao `docker-compose.yml`:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - backend
    networks:
      - copilot-network
```

---

## Passo 3 — Configurar o Roteamento no Painel

No painel Zero Trust em **Networks → Tunnels → [seu túnel] → Configure**:

| Subdomínio | Serviço interno |
|---|---|
| `api.seudominio.com` | `http://backend:8000` |
| `app.seudominio.com` | `http://frontend:3000` |

> O campo "Serviço interno" usa o **nome do container Docker** como hostname,  
> pois todos estão na mesma Docker network.

---

## Passo 4 — GitHub Secrets necessários

Configure em **Settings → Secrets and variables → Actions**:

| Secret | Descrição | Exemplo |
|---|---|---|
| `VPS_HOST` | IP da VPS Hetzner | `65.21.xxx.xxx` |
| `VPS_USER` | Usuário SSH | `root` |
| `VPS_SSH_KEY` | Conteúdo de `~/.ssh/id_ed25519` | `-----BEGIN OPENSSH...` |
| `VPS_PORT` | Porta SSH | `22` |
| `SECRET_KEY` | Chave JWT da API | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Senha do banco | Senha forte |
| `OPENAI_API_KEY` | Chave OpenAI | `sk-...` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token do túnel CF | `eyJ...` |
| `CORS_ORIGINS` | Domínio público | `api.seudominio.com` |

---

## Passo 5 — Segurança adicional recomendada

### Bloquear acesso direto ao IP da VPS

```bash
# No firewall da Hetzner (ou ufw na VPS):
# Permitir apenas SSH e tráfego interno
ufw allow 22/tcp      # SSH
ufw deny 8000/tcp     # API — nunca exposta diretamente
ufw deny 5432/tcp     # PostgreSQL — nunca exposto
ufw enable
```

### WAF no Cloudflare

Em **Security → WAF**, ative as regras:
- **OWASP Core Rule Set** — proteção geral
- **Rate Limiting** — máx. 100 req/min por IP na rota `/api/`

### Regra de IP Access (via MCP já configurado)

Use a ferramenta `create_ip_access_rule` para bloquear IPs suspeitos  
diretamente via API Cloudflare quando necessário.

---

## Verificação do Túnel

```bash
# Na VPS — verificar status do cloudflared
docker compose logs cloudflared --tail=20

# Deve aparecer:
# INF Connection ... registered connIndex=0
# INF Registered tunnel connection tunnelID=...

# Teste do health check:
curl https://api.seudominio.com/health
# Esperado: {"status": "ok", "version": "..."}
```

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `tunnel: not found` | Token inválido | Recriar túnel e atualizar Secret |
| `502 Bad Gateway` | Backend não iniciou | `docker compose logs backend` |
| `Health check falhou` | Container demorando | Aumentar `sleep 15` no workflow |
| `CORS error` | `CORS_ORIGINS` errado | Verificar variável no .env |
| PostgreSQL inacessível | Normal — só interno | Verificar via `docker compose exec postgres psql` |

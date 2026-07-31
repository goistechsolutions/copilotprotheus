# Ambientes — copilotprotheus

Este diretório contém os **templates de variáveis de ambiente** para cada estágio do projeto.
Nunca commite arquivos `.env` com valores reais — use os templates abaixo como base.

## Estrutura

```
environments/
├── dev.env.example    ← desenvolvimento local (Docker Compose / Hetzner dev)
├── hml.env.example    ← homologação (Hetzner hml)
└── prod.env.example   ← produção (Hetzner prod + Cloudflare)
```

## Como usar

```bash
# Copie o template do ambiente desejado para .env na raiz
cp environments/dev.env.example .env
# Preencha os valores reais e NUNCA commite o .env resultante
```

## Variáveis obrigatórias por ambiente

| Variável | dev | hml | prod |
|---|---|---|---|
| `POSTGRES_PASSWORD` | local simples | aleatória | gerada + Secrets |
| `SECRET_KEY` | qualquer | `openssl rand -hex 32` | `openssl rand -hex 32` |
| `ENVIRONMENT` | `development` | `homologation` | `production` |
| `DEBUG` | `true` | `false` | `false` |
| `CORS_ORIGINS` | localhost | domínio hml | domínio prod |
| `OPENAI_API_KEY` | key de dev/sandbox | key de hml | key de prod |
| `CLOUDFLARE_TUNNEL_TOKEN` | não obrigatório | obrigatório | obrigatório |

## Secrets do GitHub Actions

Os workflows de CI/CD leem os seguintes secrets do repositório:

```
VPS_HOST          IP ou hostname do servidor Hetzner
VPS_USER          Usuário SSH (ex: deploy)
VPS_SSH_KEY       Chave privada SSH (conteúdo do id_ed25519)
VPS_PORT          Porta SSH (padrão: 22)
SECRET_KEY        Chave JWT para o backend
OPENAI_API_KEY    Chave da OpenAI
CLOUDFLARE_TUNNEL_TOKEN   Token do Cloudflare Tunnel (prod)
```

> Acesse: **GitHub → Settings → Secrets and variables → Actions**

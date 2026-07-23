# Scripts operacionais - Copilot Protheus

Pacote inicial de scripts para operação do ambiente descrito em `PROJECT_MEMORY.md` e `PROJECT_MEMORY_P2.md`.

## Conteúdo
- `deploy_full.sh`: atualiza repositório, faz build sem cache e sobe todos os containers.
- `deploy_admin_only.sh`: recompila apenas o painel administrativo.
- `healthcheck_stack.sh`: valida containers, endpoints locais e status do Ollama.
- `backup_pgvector.sh`: gera backup do PostgreSQL/pgvector via `docker exec`.
- `env.backend.example`: modelo base do `backend/.env`.
- `env.admin-frontend.example`: modelo base do `admin-frontend/.env`.
- `docker-compose.override.multiempresa.yml`: exemplo inicial de override para endurecimento operacional multiempresa.

## Premissas
- Executar na VPS Hetzner, na raiz do repositório.
- O projeto usa `docker-compose.yml` na raiz.
- O frontend `/frontend` continua com deploy automático pelo Cloudflare Pages.
- O painel admin, backend, middleware e banco sobem na Hetzner via Docker.
- O Ollama roda no host Linux e **não** em container.

## Uso rápido
```bash
chmod +x *.sh
./deploy_full.sh
./healthcheck_stack.sh
./backup_pgvector.sh
```

## Atenção
Esses scripts são um pacote operacional inicial. Antes de produção comercial multiempresa, valide:
1. nomes reais dos serviços no `docker-compose.yml`;
2. paths reais do repositório na VPS;
3. política de backup/restore;
4. secrets e credenciais fora de valores default;
5. endpoints reais expostos pelo backend.

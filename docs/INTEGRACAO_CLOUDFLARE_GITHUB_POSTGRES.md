# Integração: Cloudflare + GitHub Actions + PostgreSQL

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                              │
│  Usuário → HTTPS → Cloudflare Tunnel → API FastAPI       │
└──────────────────────────┬──────────────────────────────┘
                           │ Docker Network (interno)
              ┌────────────▼─────────────┐
              │    VPS Hetzner           │
              │  ┌───────────────────┐   │
              │  │  FastAPI (backend)│   │
              │  └────────┬──────────┘   │
              │           │              │
              │  ┌────────▼──────────┐   │
              │  │  PostgreSQL (db)  │   │
              │  │  schema: protheus │   │
              │  │  schema: copilot  │   │
              │  └───────────────────┘   │
              └──────────────────────────┘
                           ▲
              ┌────────────┘
              │  GitHub Actions (CI/CD)
              │  Push main → deploy automático
              └──────────────────────────────
```

## Componentes

### Cloudflare Tunnel
- Expõe a API FastAPI via HTTPS sem abrir portas na VPS
- Zero Trust: nenhuma porta 80/443 precisa estar aberta no firewall
- Token configurado via secret `CLOUDFLARE_TUNNEL_TOKEN`
- DNS gerenciado automaticamente pelo Cloudflare

### GitHub Actions
- `deploy-backend.yml`: deploy automático a cada push na `main`
- `db-check.yml`: health check diário às 07:00 BRT
- Secrets obrigatórios: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`, `SECRET_KEY`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY`, `CLOUDFLARE_TUNNEL_TOKEN`, `CORS_ORIGINS`

### PostgreSQL — Schemas

| Schema | Finalidade | Permissão |
|--------|-----------|----------|
| `protheus` | Dados replicados do ERP Protheus | Somente leitura pela API |
| `copilot` | Dados próprios do Copilot | Leitura e escrita |

## Regras Obrigatórias — Tabelas Protheus

Baseado no documento `Tabelas-de-referencia.pdf`:

1. **D_E_L_E_T_**: sempre incluir `WHERE d_e_l_e_t_ = ' '` — registros com `'*'` estão logicamente deletados
2. **xx_FILIAL**: filtrar conforme o modo da SX2 (vazio para tabelas compartilhadas `X2_MODO = 'C'`)
3. **R_E_C_N_O_**: é chave física — nunca usar como chave de negócio
4. **Escrita**: NUNCA fazer INSERT/UPDATE/DELETE direto nas tabelas `protheus.*` — apenas via API ADVPL/ExecAuto
5. **Performance**: verificar índices na SIX antes de queries em tabelas grandes

## Views Seguras (filtros pré-aplicados)

Usar sempre as views do schema `protheus.v_*` nas queries da API:

```sql
-- ✅ Correto — filtros já aplicados
SELECT * FROM protheus.v_clientes_ativos WHERE a1_filial = '01';
SELECT * FROM protheus.v_estoque_disponivel WHERE b2_filial = '01';
SELECT * FROM protheus.v_contas_receber_abertas WHERE e1_filial = '01';
SELECT * FROM protheus.v_pedidos_venda WHERE c5_filial = '01';

-- ❌ Evitar — risco de trazer registros deletados
SELECT * FROM protheus.sa1;
```

## Tabelas por Módulo

### Backoffice / Financeiro
| Tabela | Descrição | View segura |
|--------|-----------|-------------|
| `protheus.se1` | Contas a Receber | `v_contas_receber_abertas` |
| `protheus.se2` | Contas a Pagar | — |
| `protheus.se5` | Movimento Bancário | — |
| `protheus.sf2` | NF de Saída (cabeçalho) | — |
| `protheus.sd2` | NF de Saída (itens) | — |
| `protheus.ct2` | Lançamentos Contábeis | — |

### Comercial / Vendas
| Tabela | Descrição | View segura |
|--------|-----------|-------------|
| `protheus.sc5` | Pedidos de Venda (cabeçalho) | `v_pedidos_venda` |
| `protheus.sc6` | Itens do Pedido de Venda | `v_pedidos_venda` |
| `protheus.sa1` | Cadastro de Clientes | `v_clientes_ativos` |

### Estoque / Manufatura
| Tabela | Descrição | View segura |
|--------|-----------|-------------|
| `protheus.sb1` | Cadastro de Produtos | — |
| `protheus.sb2` | Saldos de Estoque | `v_estoque_disponivel` |

### Dicionário de Dados
| Tabela | Descrição |
|--------|-----------|
| `protheus.sx2` | Modo de compartilhamento das tabelas |
| `protheus.sx3` | Dicionário de campos |

## Secrets GitHub Actions Necessários

```
Settings → Secrets and variables → Actions → New repository secret

VPS_HOST              → IP da VPS Hetzner
VPS_USER              → root (ou usuário SSH)
VPS_SSH_KEY           → conteúdo do arquivo ~/.ssh/id_ed25519
VPS_PORT              → 22
SECRET_KEY            → resultado de: openssl rand -hex 32
POSTGRES_PASSWORD     → senha forte para o banco
OPENAI_API_KEY        → chave da OpenAI
CLOUDFLARE_TUNNEL_TOKEN → token do túnel Cloudflare
CORS_ORIGINS          → https://copilotprotheus.com.br
API_HEALTH_URL        → https://api.copilotprotheus.com.br/health
```

## Sequência de Deploy (automatizada)

```
1. git push origin main
2. GitHub Actions dispara deploy-backend.yml
3. Job test: valida SQL e faz lint do Python
4. Job backup-db: faz pg_dump antes de qualquer mudança
5. Job deploy:
   a. Cria .env na VPS com os Secrets
   b. rsync do código local → VPS
   c. docker compose down
   d. docker compose build
   e. Aplica migrations SQL (database/migrations/*.sql)
   f. docker compose up -d
   g. Health check da API
```

## Comandos Úteis na VPS

```bash
# Ver logs em tempo real
cd /root/copilotprotheus && docker compose logs -f

# Acessar o PostgreSQL diretamente
docker compose exec db psql -U copilot -d copilotprotheus

# Aplicar uma migration manualmente
docker compose exec -T db psql -U copilot -d copilotprotheus \
  < database/migrations/001_protheus_core_tables.sql

# Verificar sincronização das tabelas
docker compose exec db psql -U copilot -d copilotprotheus -c \
  "SELECT tabela, status, registros_novos, concluido_em FROM copilot.sync_log ORDER BY iniciado_em DESC LIMIT 10;"

# Backup manual
docker compose exec db pg_dump -U copilot copilotprotheus | gzip > backup_manual.sql.gz
```

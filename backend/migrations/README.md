# Migrations — copilot_protheus

## Estrutura

```
migrations/
├── README.md                          ← este arquivo
├── V001__estrutura_inicial.sql        ← criação completa do banco
└── V002__...                          ← próximas migrations
```

## Convenção de nomenclatura

`V{versão}__{descricao_snake_case}.sql`

- Versão sempre com 3 dígitos: V001, V002 ...
- Descrição em snake_case, sem acentos
- Cada arquivo é **idempotente** (usa IF NOT EXISTS)

## Como aplicar manualmente na VPS

```bash
# Via Docker
docker exec -i copilotprotheus-db-1 \
  psql -U postgres -d copilot_protheus \
  < backend/migrations/V001__estrutura_inicial.sql

# Via psql direto
psql -h localhost -U postgres -d copilot_protheus \
  -f backend/migrations/V001__estrutura_inicial.sql
```

## Regras obrigatórias (Protheus)

> Baseado no dicionário de dados Protheus.

1. **D_E_L_E_T_**: todo SELECT deve filtrar `WHERE deleted = ' '`
2. **xx_FILIAL**: primeira coluna de toda tabela — filtrar conforme SX2
3. **R_E_C_N_O_**: chave física — útil para joins, não usar como chave de negócio
4. **Nunca** INSERT/UPDATE/DELETE direto no Protheus — apenas via ADVPL/TLPP

## Módulos cobertos

| Módulo    | Tabelas                                      |
|-----------|----------------------------------------------|
| SIGAFAT   | SA1, SC5, SC6, SF2, SD2                      |
| SIGACOM   | SA2, SF1, SD1                                |
| SIGAEST   | SB1, SB2, SD3                                |
| SIGAFIN   | SE1, SE2, SE5                                |
| SIGAFIS   | SF1, SF2                                     |
| CopilotAI | usuarios, conversas, mensagens, logs         |

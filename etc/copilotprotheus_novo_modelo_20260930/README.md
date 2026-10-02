# Pacote de migrations — novo modelo Copilot Protheus

Este pacote foi criado a partir do inventário `schemas_tables.csv`, da arquitetura descrita no notebook e do ajuste explícito do catálogo de módulos:

```text
id = 5
module_sigla = SIGAFAT
description = Vendas e Faturamento
```

## Conteúdo

- migration 001: catálogo numérico de módulos, migração de contratos e compatibilidade temporária;
- migration 002: factory seguro/idempotente de schema por tenant;
- migration 003: função controlada para copiar metadados legados sem apagar origem;
- migration 004: verificações somente leitura;
- migrations DOWN correspondentes;
- mapeamento de arquivos e script de descoberta de referências.

## Segurança adotada

- nenhuma tabela transacional do Protheus é criada;
- nenhuma estrutura legada é apagada automaticamente;
- preflights abortam em caso de códigos/siglas duplicados, órfãos ou FKs desconhecidas;
- o schema do tenant vem de `public.tenant.schema_name`, é validado e usado com identificadores SQL escapados;
- funções são `SECURITY DEFINER`, com `search_path` fixo, e têm execução revogada de `PUBLIC`;
- o backend ainda deve derivar tenant e usuário da autenticação; o factory não substitui autorização da API.

## Limitações

O pacote não foi executado contra uma instância PostgreSQL real neste ambiente. Antes da produção, execute em clone restaurado do banco, rode os preflights, valide contratos HTTP e ajuste o código localizado pelo script de mapeamento.

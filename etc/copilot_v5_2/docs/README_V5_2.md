# CopilotProtheus v5.2 - pacote inicial

## Objetivo
Implementar o item 2 do backlog: catálogo real por tenant, snapshot de dicionário SX2/SX3/SXG/SIX e persistência de permissões por tabela/campo.

## Conteúdo
- sql/001_catalog_snapshot_permissions.sql
- app/models_v52.py
- app/catalog_service_v52.py
- jobs/sync_dictionary_v52.py

## Ordem sugerida
1. Aplicar o SQL no PostgreSQL do backend.
2. Integrar os modelos ao projeto atual.
3. Ajustar o job para consumir o endpoint real do Protheus REST do seu ambiente.
4. Criar endpoint admin para disparar snapshot.
5. Criar endpoint agente para consultar catálogo permitido.

## Pontos que precisam validação
- Endpoint REST real disponível para leitura de SX2, SX3, SXG e SIX.
- Formato JSON retornado pelo Protheus no seu conector.
- Existência e estrutura das tabelas RBAC já implantadas na v3/v4.
- Estratégia de autenticação do backend para resolver role_ids do usuário.

## Risco funcional
O snapshot deve armazenar apenas metadados do dicionário, sem conteúdo transacional do cliente.

## Risco técnico
Os nomes de campos retornados por Query/REST podem variar por implementação; por isso o mapeamento do job está preparado com fallback e precisa de homologação técnica.

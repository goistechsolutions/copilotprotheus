# Decisão arquitetural — separação global x tenant

## `public`: control plane

Mantém exclusivamente identidade, tenancy, catálogo e governança global:

- tenants;
- usuários e RBAC funcional;
- planos, contratos e módulos contratados;
- catálogo mestre de módulos Protheus;
- domínios, relação domínio-módulo, intents e catálogo de apresentação;
- auditoria de administração da plataforma;
- contadores de uso.

`public` não contém conversas, prompts, mensagens, datasets, análises, dashboards, memórias ou dicionários empresariais.

## `<tenant_schema>`: data plane do tenant

Mantém:

- empresas, ambientes, conexões e acesso por empresa;
- projeção dos módulos contratados (`tenant_modules`);
- regras empresariais;
- dicionário e snapshots;
- documentos, chunks e memórias de RAG;
- conversas, mensagens, análises, dashboards, eventos, favoritos e sessões;
- auditoria de consultas do agente.

Como o schema já identifica o tenant, as tabelas internas não repetem `tenant_id`.

## Fluxo canônico

```text
identidade autenticada
→ public.tenants.schema_name
→ contexto autorizado (empresa/ambiente/módulo)
→ mensagem do usuário
→ AnalysisContext versionado
→ mensagem do assistente
→ dashboard da mesma análise
→ commit único
```

O frontend nunca fornece `schema_name` e não é autoridade para `tenant_id` ou `user_id`.


## Allowlist de tabelas e campos

O novo modelo não cria tabelas redundantes de permissão física por tabela/campo. A allowlist é o próprio conteúdo do snapshot ativo em `dictionary_tables` e `dictionary_fields`. O backend ainda valida usuário, empresa, ambiente, módulo, operação e presença da entidade no snapshot autorizado.

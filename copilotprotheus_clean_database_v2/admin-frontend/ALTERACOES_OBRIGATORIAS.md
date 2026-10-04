# Admin frontend — alterações obrigatórias

O painel não consulta schemas diretamente.

- operações globais usam endpoints sobre `public` para tenants, usuários, contratos, módulos, domínios e intents;
- operações empresariais usam endpoints administrativos tenant-aware;
- o backend resolve o schema do tenant selecionado;
- toda leitura cross-tenant exige papel administrativo e audit log;
- selects de módulo usam metadados retornados pelo backend;
- nenhuma tela envia `schema_name` como fonte de autoridade.

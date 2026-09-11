# Contrato verificado da API TOTVS GenericQuery

Fonte oficial: https://tdn.totvs.com/display/public/framework/GenericQuery

A API é exposta em `api/framework/v1/genericQuery` e exige `SECURITY=1` no socket REST. O contrato principal usa os parâmetros `Tables` (obrigatório), `FilialFilter` (padrão true), `DeletedFilter`, `Where` e `FromQry`. A documentação permite selecionar múltiplos aliases e alerta que, sem `FromQry`, a junção entre tabelas precisa estar explicitamente em `Where`, evitando produto cartesiano.

O retorno padrão é um objeto com `items`, `remainingRecords`, `protectedDataFields`, `nivelFields` e `hasNext`. O cliente deve normalizar `items` como linhas. A API valida privilégios, nível de campo e dados protegidos; campos não autorizados podem ser omitidos e listados em `protectedDataFields`/`nivelFields`.

Para consultas complexas, `FromQry` informa o FROM/JOIN e deve usar aliases SX2. Filtros de filial e exclusão lógica são parâmetros próprios e não devem ser presumidos se o contrato da chamada exigir outro comportamento.

O formato Smart View é opcional e exige `Format=smartview` e `KeyProperty`; não deve ser usado em consultas analíticas comuns.

Implicações para o Copilot: manter OAuth2/Bearer no header; não enviar usuário/senha no GenericQuery; montar GET para o endpoint GenericQuery com parâmetros `Tables`, `Fields`, `Where`, `FromQry`, `FilialFilter` e `DeletedFilter`; normalizar `items`; preservar avisos de campos protegidos; rejeitar múltiplas tabelas sem junção explícita; não usar o payload `cQuery` do QueryRest nesse endpoint.

# Estabilidade do Painel Administrativo — Plano de Implementação

> **Para agentes de execução:** implementar tarefa por tarefa, validando cada etapa antes de avançar.

**Objetivo:** tornar o fluxo de módulos por empresa estável e seguro, usando o catálogo global de módulos como fonte única e mantendo a autenticação administrativa existente.

**Arquitetura:** manter `public.protheus_modules_master` como fonte canônica. O backend normalizará e validará siglas antes de persistir módulos no schema do tenant; o frontend consumirá somente o contrato normalizado. As rotas continuarão protegidas e passarão a usar a dependência `require_admin`, evitando duas implementações de autenticação.

**Stack:** FastAPI, Pydantic 2, SQLAlchemy, PostgreSQL, React, Axios, Vite, Pytest.

**Especificação:** `Relatorio_auditoria_integridade_admin_frontend.md` e `AGENTS.md`.

## Restrições globais

- A fonte canônica de módulos é `public.protheus_modules_master`.
- O backend deve validar tenant, empresa, módulo contratado e permissão; nunca confiar no frontend.
- Não usar `business_domains.id` como código de módulo.
- Não criar fallback hardcoded para módulos.
- Não alterar dados operacionais do Protheus.
- Preservar alterações locais existentes e não misturar correções não relacionadas.

---

### Tarefa 1: Canonicalizar o contrato de módulos

**Arquivos:**
- Modificar: `backend/app/schemas/company_modules.py`
- Modificar: `backend/app/api/company_routes.py`
- Modificar: `admin-frontend/src/services/companyModulesApi.js`
- Modificar: `admin-frontend/src/components/companies/CompanyModulesTab.jsx` somente se o contrato exigir alteração de apresentação
- Testar: `backend/tests/test_company_crud_contract.py`

**Interfaces:**
- Entrada: `CompanyModulesSaveRequest.modules[].module_code` continua sendo a sigla oficial normalizada, como `SIGAFAT`.
- Saída: cada item disponível e atribuído contém `module_code` como sigla, `mod_code` como código numérico e `module_name` como nome amigável.
- Erro: usar objeto com `code`, `message` e, quando disponível, `traceId`; não retornar módulo desconhecido como código `0`.

- [ ] Adicionar validação de que o item do catálogo retornado contém `module_code` não vazio e `mod_code` inteiro positivo.
- [ ] Remover a normalização frontend que converte valores ausentes em `0`; falhar explicitamente quando o backend retornar item inválido.
- [ ] Manter uma única função frontend para normalizar somente espaços e caixa da sigla.
- [ ] Criar teste unitário do serviço para rejeitar módulo inexistente.
- [ ] Executar os testes focados do contrato.

### Tarefa 2: Validar módulos contra o catálogo canônico

**Arquivos:**
- Modificar: `backend/app/services/company_module_service.py`
- Testar: `backend/tests/test_company_crud_contract.py`

**Interfaces:**
- Consome: `CompanyModulesSaveRequest` e `public.protheus_modules_master`.
- Produz: gravação em `<tenant>.protheus_modules` somente para siglas ativas encontradas no master.

- [ ] Extrair um helper interno `load_active_module_master(db) -> dict[str, dict]` para centralizar a consulta.
- [ ] Rejeitar sigla ausente, código nulo, código não positivo ou sigla duplicada no master.
- [ ] Preservar rollback em qualquer falha.
- [ ] Remover qualquer fallback de lista fixa ou código zero.
- [ ] Adicionar teste para módulo inexistente e teste para módulo válido.
- [ ] Executar `pytest backend/tests/test_company_crud_contract.py -q`.

### Tarefa 3: Consolidar a autenticação das rotas de módulos

**Arquivos:**
- Modificar: `backend/app/api/company_routes.py`
- Testar: `backend/tests/test_admin_security_and_knowledge.py` ou novo teste focado em `backend/tests/test_company_modules_security.py`

**Interfaces:**
- Consome: `require_admin` de `backend/app/core/admin_security.py`.
- Produz: dependência `admin` disponível nos handlers; o tenant é derivado da empresa resolvida no backend.

- [ ] Substituir `verify_admin_key` nas quatro rotas de módulos por `admin: dict = Depends(require_admin)`.
- [ ] Preservar a rejeição de chamadas sem cookie JWT válido ou Basic Auth válido.
- [ ] Antes de operações de escrita/sincronização, aplicar `authorize_admin_access` com permissões distintas quando o projeto já definir os nomes canônicos.
- [ ] Não aceitar `tenant_id` do corpo para redefinir o tenant da empresa.
- [ ] Adicionar teste de não autenticado e teste de escopo de tenant, sem depender de banco real.
- [ ] Executar os testes focados de segurança.

### Tarefa 4: Padronizar o cliente frontend

**Arquivos:**
- Modificar: `admin-frontend/src/services/companyModulesApi.js`
- Modificar: `admin-frontend/src/components/companies/CompanyModulesTab.jsx` se necessário

**Interfaces:**
- Consome: resposta canônica do backend.
- Produz: `module_code` como sigla, `mod_code` positivo e `module_name` não vazio.

- [ ] Remover suporte silencioso a nomes alternativos `mod_sigla`/`mod_name` quando o contrato canônico estiver garantido.
- [ ] Validar resposta inválida com erro amigável e sem selecionar automaticamente módulos incorretos.
- [ ] Preservar validação de `environment_code` real.
- [ ] Manter `saveCompanyModules` enviando apenas siglas habilitadas e não enviar código numérico inventado.
- [ ] Executar lint e build do admin frontend.

### Tarefa 5: Validação final

**Arquivos:**
- Nenhuma alteração adicional prevista.

- [ ] Executar testes backend focados.
- [ ] Executar suíte backend disponível, registrando falhas preexistentes separadamente.
- [ ] Executar `npm run lint` em `admin-frontend`.
- [ ] Executar `npm run build` em `admin-frontend`.
- [ ] Revisar `git diff` e confirmar que somente arquivos previstos foram alterados.
- [ ] Atualizar o relatório de auditoria apenas se uma conclusão confirmada mudar.

## Lacunas explicitamente fora desta execução

A convergência física de `protheus_modules_master`, a migração definitiva de `tenant_schemas` para `dictionary_*`, a modelagem de `AnalysisContext` e o versionamento das regras de negócio exigem validação do banco aplicado e serão tratadas em planos separados, não inferidas durante esta correção.

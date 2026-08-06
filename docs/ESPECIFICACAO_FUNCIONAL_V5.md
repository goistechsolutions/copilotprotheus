# Especificação Funcional — Arquitetura Multi-Tenant por Schema
## Copilot Protheus V5 — Base de Conhecimento por Empresa

**Data:** 01/08/2026 | **Versão:** 5.0 | **Status:** Aprovado para Implementação

---

## 1. Resumo Executivo

O Copilot Protheus é uma plataforma SaaS multi-empresa hospedada na nuvem (Hetzner + Cloudflare).
Cada empresa contratante (tenant) possui um Schema PostgreSQL exclusivo, garantindo:
- Isolamento total de dados entre empresas
- Inclusão automática de campos e tabelas customizados do cliente
- Regras específicas de interpretação por empresa
- Segurança: nenhuma empresa acessa dados de outra

---

## 2. Arquitetura de Dados — Visão Geral

```
banco: copilot_protheus
│
├── schema: public (governança da plataforma)
│   ├── tenant_registry ← cadastro de empresas contratantes
│   ├── protheus_modules_master ← catálogo GLOBAL de módulos (carga via SYS_USR_MODULE)
│   ├── plans ← planos de assinatura
│   ├── platform_admins ← administradores da plataforma
│   ├── users ← usuários (multi-empresa)
│   ├── roles / permissions ← controle de acesso RBAC
│   └── platform_audit_log ← auditoria global
│
├── schema: "acme" (empresa Acme Ltda)
│   ├── company_info ← dados e credenciais REST da empresa
│   ├── protheus_modules ← módulos CONTRATADOS pela Acme
│   ├── tenant_schemas ← dicionário completo: SX2 + SX3 + SIX (por módulo)
│   ├── field_rules ← regras específicas da empresa por campo
│   ├── users ← usuários da empresa
│   └── query_audit ← histórico de consultas da empresa
│
└── schema: "contoso" (empresa Contoso S.A.)
    └── (mesma estrutura acima)
```

---

## 3. Schema `public` — Tabelas e Responsabilidades

### 3.1 `public.protheus_modules_master`
**Propósito:** Catálogo único e global de todos os módulos Protheus disponíveis na plataforma.
Alimentado via carga inicial da query `SYS_USR_MODULE` e atualizado por sincronização.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Identificador único |
| mod_code | INTEGER | Código numérico do módulo (USR_MODULO) |
| mod_sigla | VARCHAR(30) | Sigla do módulo (ex: SIGAFIN) |
| mod_name | VARCHAR(150) | Nome completo (ex: SIGAFIN - Financeiro) |
| active | BOOLEAN | Ativo/inativo na plataforma |
| created_at | TIMESTAMPTZ | Data de inclusão |

**Uso:** Fonte para o combobox de seleção de módulos no cadastro de empresas.

---

### 3.2 `public.tenant_registry`
**Propósito:** Registro central de cada empresa contratante.
Ao criar um registro aqui, o sistema provisiona automaticamente o schema exclusivo.

**Campos relevantes:**
| Campo | Tipo | Descrição |
|---|---|---|
| tenant_code | VARCHAR(50) UK | Slug único (ex: "acme") — vira nome do schema |
| schema_name | VARCHAR(63) UK | Nome real do schema PostgreSQL |
| status | VARCHAR(20) | provisioning → active → suspended |

---

## 4. Schema por Tenant — Tabelas e Responsabilidades

### 4.1 `{tenant}.company_info`
Dados cadastrais da empresa e credenciais de acesso ao AppServer Protheus.

### 4.2 `{tenant}.protheus_modules`
Lista dos módulos que a empresa contratou/ativou.
Alimentada no momento do cadastro da empresa via seleção no combobox.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| mod_code | INTEGER | Código numérico (FK lógica → public.protheus_modules_master.mod_code) |
| mod_sigla | VARCHAR(30) | Sigla do módulo |
| mod_name | VARCHAR(150) | Nome amigável |
| active | BOOLEAN | Módulo ativo para este tenant |

### 4.3 `{tenant}.tenant_schemas` ← PRINCIPAL
Cache completo da estrutura do dicionário Protheus para a empresa.
Contém SX2 (tabelas), SX3 (campos), SIX (índices) dos módulos contratados.
Inclui tabelas e campos customizados (X_ prefix, campos Z).

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| id | BIGSERIAL PK | |
| mod_code | INTEGER | Código do módulo |
| mod_sigla | VARCHAR(30) | Sigla do módulo |
| chave | VARCHAR(10) | Chave Protheus (ex: SE1, SA1) |
| tabela | VARCHAR(20) | Nome físico (ex: SE1010) |
| nome | VARCHAR(120) | Nome amigável (ex: Contas a Receber) |
| campo | VARCHAR(10) | Nome do campo (ex: E1_NUM) |
| campo_titulo | VARCHAR(80) | Título do campo |
| campo_tipo | VARCHAR(5) | Tipo: C, N, D, L, M |
| campo_tamanho | INTEGER | Tamanho |
| campo_decimal | INTEGER | Decimais |
| campo_obrigatorio | BOOLEAN | Campo obrigatório |
| campo_usado | BOOLEAN | Campo em uso (X3_USED) |
| campo_descricao | TEXT | Descrição do campo |
| is_customizado | BOOLEAN | Campo customizado (Z ou _) |
| schema_json | JSONB | Payload completo SX3 para uso pelo agente |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 4.4 `{tenant}.field_rules`
Regras específicas da empresa para interpretação de campos pelo agente.
Ex: "O campo B1_GRUPO = '001' significa Matéria-Prima nesta empresa".

### 4.5 `{tenant}.query_audit`
Histórico de todas as consultas realizadas pelos usuários desta empresa.

---

## 5. Fluxo de Cadastro de Empresa

```
1. Admin acessa painel → "Nova Empresa"
2. Preenche: nome, CNPJ, credenciais REST do Protheus
3. Seleciona módulos contratados (combobox carregado de public.protheus_modules_master)
4. Clica "Cadastrar"
5. Backend executa:
   a. INSERT em public.tenant_registry (status = 'provisioning')
   b. CREATE SCHEMA "{tenant_code}"
   c. CREATE TABLE {tenant}.company_info, protheus_modules, tenant_schemas...
   d. INSERT dos módulos selecionados em {tenant}.protheus_modules
   e. Chama Protheus REST → busca SX2+SX3+SIX dos módulos → popula {tenant}.tenant_schemas
   f. UPDATE public.tenant_registry SET status = 'active'
```

---

## 6. Fluxo de Consulta pelo Agente

```
Usuário pergunta → Agente recebe
↓
1. Identifica tenant (empresa do usuário logado)
2. SET search_path TO "{tenant}", public
3. Busca em {tenant}.tenant_schemas as tabelas relevantes à pergunta
4. Busca em {tenant}.field_rules regras específicas da empresa
5. Monta contexto: tabelas + campos + regras
6. Envia para OpenAI / Gemini / Ollama → gera SQL Oracle
7. Executa SQL no Protheus via REST /QueryRest
8. Retorna resultado
9. Registra em {tenant}.query_audit
```

---

## 7. Premissas e Regras

- Nenhum schema numérico é permitido (`resolve_clean_tenant` converte automaticamente)
- O dicionário inclui TODOS os campos, inclusive customizados (`is_customizado = TRUE`)
- A carga inicial da `SYS_USR_MODULE` popula `public.protheus_modules_master`
- Cada empresa pode ter regras de negócio próprias em `field_rules`
- O agente NUNCA acessa dados de outro tenant (`search_path` garante isolamento)
- Filtro `D_E_L_E_T_ <> '*'` é obrigatório em todas as queries Oracle geradas

---

## 8. Critérios de Aceite

- [x] Cadastro de empresa cria schema PostgreSQL automaticamente
- [x] Combobox de módulos carrega de `public.protheus_modules_master`
- [x] Sincronização do dicionário importa campos customizados (Z, X_)
- [x] Agente usa `field_rules` da empresa no contexto do prompt
- [x] Query audit registra cada consulta com resultado e tempo
- [x] Isolamento: usuário da empresa A não acessa dados da empresa B

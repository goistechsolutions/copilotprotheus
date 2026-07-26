# Documentação Técnica — Assistente Inteligente Protheus
**Versão:** 1.0.0 | **Data:** 2026-06-20 | **Projeto:** Copilot Protheus

---

## 1. Visão Geral

Implantação de um assistente inteligente integrado ao Protheus para análise de dados, suporte operacional e geração de relatórios sob demanda. O assistente **não executa ações transacionais** — atua exclusivamente em modo leitura, orientando o usuário, gerando SQL analítico e respondendo perguntas de negócio.

### Premissas
- Todas as APIs Protheus são somente leitura.
- O assistente não altera registros no banco de dados.
- Contexto da sessão é capturado via URL ou headers HTTP.
- Histórico de interações é auditado na tabela ZIA.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  Protheus WebApp (Edge / SmartClient)                   │
│  └─ Extensão Edge injeta Widget React (iframe)          │
└──────────────────┬──────────────────────────────────────┘
                   │ POST /chat/ask + contexto
┌──────────────────▼──────────────────────────────────────┐
│  Middleware Node.js (:3001)                             │
│  ├─ Classificação de intenção                          │
│  ├─ Enriquecimento de contexto                         │
│  └─ Chamada às APIs REST do Protheus                   │
└──────────────────┬──────────────────────────────────────┘
                   │ GET /rest/* (ADVPL)
┌──────────────────▼──────────────────────────────────────┐
│  Protheus REST Server (ADVPL)                           │
│  ├─ /rest/pedidos     (SC5/SC6)                        │
│  ├─ /rest/titulos     (SE1)                            │
│  ├─ /rest/saldo       (SB2)                            │
│  └─ /rest/compras     (SC7)                            │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Banco de Dados (SQL Server / Oracle)                   │
│  Tabelas: SC5, SC6, SE1, SB2, SC7, SA1, SB1            │
└─────────────────────────────────────────────────────────┘
                   │ POST /api/ask (enriquecido)
┌──────────────────▼──────────────────────────────────────┐
│  Backend FastAPI (:8000)                                │
│  ├─ Classificação IA                                   │
│  ├─ Geração de resposta                                │
│  └─ Auditoria ZIA                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Captura de Contexto

O contexto da sessão é capturado via query string da URL ao abrir o widget, ou via headers HTTP nas chamadas ao middleware.

### Parâmetros suportados

| Parâmetro | Origem | Descrição |
|---|---|---|
| `environment` | URL / header | Ambiente Protheus (DEV01, PROD) |
| `company` | URL / header | Empresa |
| `branch` | URL / header | Filial |
| `module` | URL / header | Módulo ativo (SIGACOM, SIGAFAT...) |
| `user` | URL / header | Usuário Protheus |
| `station` | URL / header | Estação de trabalho |
| `session_id` | URL / gerado | Identificador da sessão |
| `pedido` | URL | Número do pedido ativo |

### Exemplo de URL com contexto
```
http://localhost:5173?environment=DEV01&company=Matriz&branch=01&module=SIGACOM&user=admin&pedido=001234
```

---

## 4. Classificação de Intenção

O Middleware classifica a pergunta do usuário antes de determinar qual API Protheus chamar.

### Tipos de intenção

| Intenção | Módulo | Tabelas | Exemplo de pergunta |
|---|---|---|---|
| `analise_faturamento` | SIGAFAT | SC5, SC6 | "Quais pedidos não foram faturados hoje?" |
| `financeiro` | SIGAFIN | SE1, SE2 | "Quais títulos estão vencidos?" |
| `estoque` | SIGAEST | SB2, SB1 | "Produto com saldo abaixo do mínimo?" |
| `compras` | SIGACOM | SC7, SA2 | "Pedidos de compra em atraso?" |
| `geral` | — | — | "O que é SIGAFAT?" |

### Lógica de classificação (Middleware)
```js
function classificarIntencao(question, module) {
  const q = question.toLowerCase()
  if (q.includes('faturamento') || q.includes('pedido de venda') || module === 'SIGAFAT') return 'analise_faturamento'
  if (q.includes('titulo') || q.includes('inadimplencia') || q.includes('financeiro') || module === 'SIGAFIN') return 'financeiro'
  if (q.includes('saldo') || q.includes('estoque') || q.includes('ruptura') || module === 'SIGAEST') return 'estoque'
  if (q.includes('compra') || q.includes('fornecedor') || q.includes('sc7') || module === 'SIGACOM') return 'compras'
  return 'geral'
}
```

---

## 5. Middleware Node.js

Responsável por interpretar a pergunta, classificar a intenção, chamar APIs do Protheus, enriquecer o contexto e encaminhar ao backend.

### Fluxo interno
```
POST /chat/ask
  → classificarIntencao(question, module)
  → buscarDadosProtheus(intencao, context)
  → montarPayload(question, context, dadosProtheus)
  → POST /api/ask (FastAPI)
  → retornar resposta ao widget
```

### Variáveis de ambiente
```env
PORT=3001
# Em ambiente Cloud / Multiempresa, a conexão ao Protheus é gerenciada dinamicamente via banco por tenant
PROTHEUS_BASE_URL=https://seutenant.cloud.totvs.com.br:PORTA
PROTHEUS_USER=usuario_api
PROTHEUS_PASSWORD=senha_segura
BACKEND_URL=http://backend:8000
CORS_ORIGIN=https://copilot.suaempresa.com.br
```

---

## 6. APIs REST Protheus (ADVPL)

Todos os serviços são somente leitura e criados como **REST handlers** no Protheus.

### 6.1 Pedidos de Venda (SC5/SC6)
```advpl
WSRESTFUL PedidosRest DESCRIPTION "Leitura de pedidos de venda"
  WSMETHOD GET DESCRIPTION "Retorna pedidos filtrados"
End WSRESTFUL

WSMETHOD GET WSRECEIVE cPedido, cFilial WSSERVICE PedidosRest
  Local cQuery := ""
  Local aRet   := {}
  cQuery := "SELECT C5_NUM, C5_CLIENTE, C5_EMISSAO, C5_NOTA "
  cQuery += "FROM " + RetSqlName("SC5") + " SC5 "
  cQuery += "WHERE SC5.D_E_L_E_T_ = '' "
  If !Empty(cPedido)
    cQuery += "AND C5_NUM = '" + cPedido + "' "
  EndIf
  If !Empty(cFilial)
    cQuery += "AND C5_FILIAL = '" + cFilial + "' "
  EndIf
  // montar retorno JSON
  oRest:setResponse(FWJsonSerialize(aRet))
Return .T.
```

### 6.2 Títulos a Receber (SE1)
```advpl
// GET /rest/titulos?cliente=000001&vencidos=S
cQuery := "SELECT E1_NUM, E1_CLIENTE, E1_VENCTO, E1_VALOR, E1_SALDO "
cQuery += "FROM " + RetSqlName("SE1") + " SE1 "
cQuery += "WHERE SE1.D_E_L_E_T_ = '' AND E1_TIPO <> 'NF' "
If lVencidos
  cQuery += "AND E1_VENCTO < '" + DToS(Date()) + "' "
EndIf
```

### 6.3 Saldo de Estoque (SB2)
```advpl
// GET /rest/saldo?produto=000001&filial=01
cQuery := "SELECT B2_COD, B2_FILIAL, B2_QATU, B2_QMIN, B2_CM1 "
cQuery += "FROM " + RetSqlName("SB2") + " SB2 "
cQuery += "WHERE SB2.D_E_L_E_T_ = '' AND B2_COD = '" + cProduto + "' "
```

### 6.4 Pedidos de Compra (SC7)
```advpl
// GET /rest/compras?fornecedor=000001&status=A
cQuery := "SELECT C7_NUM, C7_FORNECE, C7_PRODUTO, C7_QUANT, C7_DATPRF "
cQuery += "FROM " + RetSqlName("SC7") + " SC7 "
cQuery += "WHERE SC7.D_E_L_E_T_ = '' AND C7_RESIDUO <> '0' "
```

---

## 7. Módulo Faturamento

### Análises suportadas
- Pedidos não faturados (C5_NOTA vazio)
- Pedidos bloqueados (C5_BLOQUEI = 'S')
- Inconsistências entre SC5 e SF2
- Volume faturado por período

### Exemplo de pergunta e resposta
```
Usuário: "Quantos pedidos estão bloqueados na filial 01 hoje?"
IA: "Encontrei 3 pedidos bloqueados na filial 01 em 20/06/2026:
  - Pedido 001234 | Cliente 000015 | Motivo: crédito
  - Pedido 001237 | Cliente 000021 | Motivo: estoque
  - Pedido 001240 | Cliente 000033 | Motivo: crédito
Deseja que eu gere o SQL para extrair essa lista completa?"
```

---

## 8. Módulo Financeiro

### Análises suportadas
- Títulos vencidos por cliente (SE1)
- Inadimplência por faixa de atraso
- Fluxo de caixa dos próximos 30 dias (SE1/SE2)
- Média de prazo de recebimento

---

## 9. Módulo Estoque

### Análises suportadas
- Saldo atual por produto/filial (SB2)
- Produtos abaixo do estoque mínimo (B2_QATU < B2_QMIN)
- Ruptura por categoria
- Giro de estoque (SB9/SD3)

---

## 10. Módulo Compras

### Análises suportadas
- Pedidos de compra em aberto (SC7)
- Pedidos em atraso (C7_DATPRF < Data atual)
- Desempenho de fornecedores (SA2)
- Solicitações sem pedido (SC1 sem SC7)

---

## 11. Auditoria — Tabela ZIA

Toda pergunta e resposta é registrada para auditoria e melhoria contínua.

### Estrutura da tabela ZIA
| Campo | Tipo | Descrição |
|---|---|---|
| ZIA_USERNA | C(15) | Usuário Protheus |
| ZIA_SESSAO | C(36) | ID da sessão |
| ZIA_MODULO | C(10) | Módulo ativo |
| ZIA_EMP | C(6) | Empresa |
| ZIA_FIL | C(12) | Filial |
| ZIA_ENV | C(20) | Ambiente |
| ZIA_PERGTA | M | Pergunta do usuário |
| ZIA_RESPOS | M | Resposta da IA |
| ZIA_DTHR | D+C | Data e hora |
| ZIA_STATUS | C(1) | S=Sucesso / E=Erro |

---

## 12. Segurança

### Regras obrigatórias
- Todas as APIs REST são somente leitura (SELECT).
- Nenhum INSERT, UPDATE ou DELETE é permitido.
- Autenticação via usuário/senha Protheus nas chamadas ADVPL.
- Rate limiting de 60 req/min no middleware.
- CORS restrito ao domínio do frontend.
- Logs de auditoria em ZIA e `middleware.log`.

---

## 13. Fluxo Operacional Completo

```
1. Usuário acessa Protheus WebApp
2. Extensão Edge injeta Widget React (iframe)
3. Widget captura contexto da URL (módulo, filial, usuário)
4. Usuário digita pergunta no chat
5. Widget → POST /chat/ask → Middleware (:3001)
6. Middleware classifica intenção da pergunta
7. Middleware chama API REST Protheus conforme intenção
8. Protheus retorna dados JSON (leitura)
9. Middleware enriquece contexto com dados reais
10. Middleware → POST /api/ask → Backend FastAPI (:8000)
11. IA monta resposta contextualizada
12. Backend grava auditoria em ZIA
13. Resposta retorna ao widget e é exibida ao usuário
```

---

## 14. Boas Práticas

### Banco de dados
- Sempre filtrar por `D_E_L_E_T_ = ''`.
- Usar `RetSqlName()` para compatibilidade entre bancos.
- Nunca usar `SELECT *` — listar apenas campos necessários.
- Usar índices existentes (ex: B2_COD+B2_LOCAL para SB2).
- Evitar JOINs com mais de 3 tabelas sem necessidade.

### Middleware
- Timeout máximo de 15s nas chamadas ao Protheus.
- Cachear respostas de leitura por 60s quando possível.
- Sempre tratar erro 502 (Protheus indisponível) com mensagem clara.

### Widget
- Exibir estado de carregamento durante chamadas.
- Limitar histórico local a 50 mensagens.
- Permitir copiar resposta com um clique.

### Resposta da IA
- Respostas objetivas e estruturadas.
- Sempre indicar fonte dos dados (tabela/módulo).
- Quando gerar SQL, indicar que é para consulta apenas.
- Não inventar dados — se não encontrar, dizer claramente.

---

## 15. Checklist de Homologação

- [ ] Extensão Edge instalada e widget aparece no Protheus
- [ ] Contexto (módulo, filial, usuário) capturado corretamente
- [ ] Classificação de intenção funciona para os 4 módulos
- [ ] APIs REST Protheus respondem em menos de 5s
- [ ] Middleware enriquece contexto com dados reais
- [ ] Backend responde com análise coerente
- [ ] Auditoria gravada em ZIA após cada pergunta
- [ ] Rate limiting funciona (60 req/min)
- [ ] Widget fecha com Esc e abre com Ctrl+Shift+P
- [ ] Histórico persiste após refresh da página
- [ ] Erro de conexão exibido corretamente no widget
- [ ] APIs retornam apenas leitura — sem efeitos colaterais

---

*Documento gerado pelo Arquiteto Protheus — Copilot Protheus v1.0.0*

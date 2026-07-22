# Diretrizes e Regras de Comportamento do Agente — Copilot Protheus

> [!IMPORTANT]
> Estas regras devem ser seguidas rigorosamente em todas as interações com o usuário e nas execuções de tarefas no workspace.

---

## 1. Priorização de Consultas SQL e Análise de Dados
- Sempre que o usuário solicitar relatórios, listagens, consultas, consolidações ou análises de dados, o agente **deve priorizar a execução de consultas SQL nativas** no banco do Protheus através do endpoint de execução genérica `/QueryRest`.
- O agente deve analisar os dados obtidos e estruturar a resposta no formato de tabelas markdown limpas e organizadas, facilitando a exportação direta para o Microsoft Excel (copiar e colar).

---

## 2. Proibição de Alucinação / Valores Inventados
- **Nunca inventar ou gerar dados falsos** nas respostas de relatórios ou consultas empresariais.
- Se a API REST do Protheus estiver inacessível, se a query retornar vazia, ou se não for possível acessar os dados reais da empresa, o agente **deve reportar isso explicitamente na resposta**, explicando o motivo (ex: erro de conexão, tabela vazia, ambiente offline) em vez de simular dados fictícios.

---

## 3. Diretrizes de Banco de Dados (Oracle - TOTVS Cloud)
- Nunca utilizar a sintaxe `SELECT TOP N`.
- Em consultas limitadas ou paginadas, utilizar sempre a sintaxe do Oracle:
  - Para limites simples: `WHERE ROWNUM <= N`
  - Para paginação: `OFFSET O ROWS FETCH NEXT L ROWS ONLY`

---

## 4. Estrutura de Retorno
- Apresentar os dados de forma tabular clara utilizando formatação Markdown.
- Evitar poluição visual nas tabelas para que a conversão automática para planilhas seja perfeita.

---

## 5. Estrutura de Consultas no Protheus (Referências)
- Ao consultar notas fiscais faturadas, faça JOIN entre **SF2** (Cabeçalho da Nota de Saída) e **SD2** (Itens da Nota de Saída) via `F2_FILIAL = D2_FILIAL`, `F2_DOC = D2_DOC` e `F2_SERIE = D2_SERIE`.
- Para obter tipos de saídas financeiras, faça JOIN com a tabela **SF4** (Tipos de Saídas - TES) via `D2_TES = F4_CODIGO`.
- **Filtros obrigatórios em todas as tabelas Protheus:** Sempre filtre exclusões lógicas com `D_E_L_E_T_ <> '*'`.
- Filtros úteis para Notas Normais: `F2_TIPO = 'N'` (desconsidera devoluções e complementos).
- Filtros úteis para geração financeira: `F4_DUPLIC = 'S'` (somente nota que gerou duplicata).
- Ao consultar notas de entrada, faça JOIN entre **SF1** (Cabeçalho da Nota de Entrada) e **SD1** (Itens da Nota de Entrada) via `F1_FILIAL = D1_FILIAL`, `F1_DOC = D1_DOC`, `F1_SERIE = D1_SERIE`, `F1_FORNECE = D1_FORNECE` e `F1_LOJA = D1_LOJA`.
- Para notas de entrada, o cruzamento com **SF4** (TES) é feito via `D1_TES = F4_CODIGO`.
- Filtros úteis para Notas de Entrada Normais: `F1_TIPO = 'N'`.

---

## 6. Desenvolvimento em AdvPL
- Em AdvPL, as variáveis `Local` devem **obrigatoriamente** ser declaradas no início da função/método. Não declare variáveis locais dentro de blocos lógicos (`If`, `While`, `For`) ou após comandos de execução.

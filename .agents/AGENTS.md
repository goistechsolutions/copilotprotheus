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

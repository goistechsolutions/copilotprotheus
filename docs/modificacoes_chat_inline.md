# Atualização da Arquitetura do Chat: Inline Dashboard & Expansão Sob Demanda

Este documento detalha as mudanças arquiteturais e de fluxo aplicadas à interface do Copilot Protheus (extensão e versão web), visando manter uma experiência de chat limpa e integrada, adotando o conceito de *Inline Dashboard*.

## 1. O Problema Anterior

Inicialmente, o sistema contava com uma visualização de "tela dividida" (Split View 70/30), onde 70% da tela era ocupada pelo `StructuredResultPanel` (tabelas e gráficos grandes) e 30% pelo chat do Copilot. 
Quando executado dentro da extensão do Protheus WebApp (que ocupa nativamente um *drawer* compacto de 460px de largura), o sistema disparava automaticamente o painel de resultados a cada resposta do backend. 
Como consequência, ou a extensão expandia abruptamente a largura da janela para acomodar os painéis, ou o chat ficava comprimido visualmente ao tentar exibir os 70% de espaço da tabela no pequeno espaço da extensão.

## 2. A Solução: `InlineChatDashboard`

Para resolver isso, criamos um novo modelo de renderização de respostas onde a análise de dados acontece diretamente **dentro do balão de resposta do chat**, sem quebrar a largura da extensão.

### Novo Componente: `InlineChatDashboard.jsx`
Localizado em `frontend/src/components/InlineChatDashboard.jsx`, este componente é inserido diretamente pela `Conversation.jsx` sempre que uma mensagem do assistente contiver a propriedade `result` com dados estruturados. Ele exibe:

- **Resumo Executivo**: O texto analítico da IA contextualizando os dados.
- **Bento KPI Cards**: Cards de métricas que calculam e destacam o Total Geral (Verde), a Média (Azul) e o Ponto de Maior Volume na consulta.
- **Gráfico de Barras Embutido**: Utiliza `chart.js` de forma compacta para demonstrar a evolução ou o comparativo dos dados, renderizado no limite da largura do chat.
- **Insight Cognitivo**: Box destacada em amarelo informando deduções e confiabilidade dos dados originados via Oracle.
- **Acordeões Recolhíveis**: 
  - *Filtros Aplicados*: Mostra ambiente, empresa, filial e filtros de deleção lógica.
  - *Detalhamento*: Uma tabela rolagem embutida exibindo os 15 primeiros registros para contexto rápido.
- **Botões de Ação**: Botões compactos renderizados no rodapé do balão (Exportar Excel, Abrir Painel).

## 3. Navegação Contextual por Área e Controle do Iframe

A aplicação principal `ExecutiveDashboard.jsx` foi remodelada para servir como um *Painel Executivo Multi-Áreas* (`Financeiro`, `Vendas`, `Compras`, `Estoque`, `Contabilidade`).

### Identificação Inteligente do Módulo
A função genérica `detectQueryArea(queryText, moduleCode)` foi criada para ler o contexto do ERP (ex: `SIGAFAT`) ou analisar as intenções de texto no prompt do usuário (ex: *faturamento*, *venda*) e inferir qual é o painel de área mais apropriado para aquela resposta.

### Remoção do *Auto-Expand*
No arquivo `AgentWorkspace.jsx`, foi removido o `useEffect` que forçava um `postMessage` de `open: true` (expansão) imediatamente ao receber a resposta da IA.

**Novo Fluxo:**
1. A extensão mantém os 460px inalterados durante toda a conversa.
2. Os dados e o gráfico são renderizados de forma responsiva no fluxo do chat (Inline Dashboard).
3. Caso o usuário queira se aprofundar, ele clica no botão azul gerado no balão de resposta **`📊 Abrir Painel de [Área Detectada]`**.
4. Este botão aciona a função `onNavigateToDashboard(areaKey)` em `App.jsx`, que realiza dois passos simultâneos:
   - Troca a visualização React interna para o componente `ExecutiveDashboard` com a aba (`areaKey`) já ativada.
   - Dispara um `window.parent.postMessage({ type: 'cprot-result-state', open: true }, '*')`, sinalizando para o *content-script* da extensão Protheus expandir a janela HTML (drawer) de 460px para tela cheia/ampla.
5. Um botão nativo no dashboard permite voltar à conversa limpa (`navigateToWorkspace`), que imediatamente dispara um `postMessage` com `open: false`, encolhendo a janela graciosamente de volta para a direita.

## 4. Estética de Cabecalho

O cabeçalho do `AgentWorkspace` no modo iframe foi simplificado para coincidir com a interface finalizada aprovada, contendo *tags* minimalistas no padrão visual Stitch:
- `PROTHEUS - {Filial}`
- `{Usuario}`
- `{Perfil / Módulo}`
- Botões compactos de *Nova Consulta* e *Dark Mode*.

## Resumo dos Arquivos Modificados
- `frontend/src/App.jsx`: Configura state de roteamento `workspace` / `dashboard` e a passagem de payload de expansão via window `postMessage`.
- `frontend/src/components/InlineChatDashboard.jsx`: (Novo) Gera a resposta rica no próprio chat.
- `frontend/src/components/Conversation.jsx`: Prepara a renderização do loop de mensagens aceitando e delegando props do `InlineChatDashboard`.
- `frontend/src/pages/AgentWorkspace.jsx`: Define as regras do iframe sem Sidebar nem Split Panel, e remove o gatilho de expansão automática.
- `frontend/src/pages/ExecutiveDashboard.jsx`: Aceita a nova prop `initialArea` provinda do chat para montar a aba correta.

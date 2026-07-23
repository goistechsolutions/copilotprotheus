const INTENTS = [
  { name: 'faturamento_pedido', module: 'SIGAFAT', keywords: ['pedido de venda', 'pedido', 'nota fiscal', 'faturado', 'status do pedido'] },
  { name: 'faturamento_cliente', module: 'SIGAFAT', keywords: ['cliente', 'limite de crédito', 'limite de credito', 'risco', 'cadastro de cliente'] },
  { name: 'financeiro_receber', module: 'SIGAFIN', keywords: ['titulo', 'títulos', 'financeiro', 'inadimplencia', 'vencido', 'contas a receber', 'recebimento'] },
  { name: 'financeiro_pagar', module: 'SIGAFIN', keywords: ['contas a pagar', 'pagamento', 'fornecedor a pagar'] },
  { name: 'estoque_saldo', module: 'SIGAEST', keywords: ['saldo', 'estoque', 'ruptura', 'mínimo', 'minimo', 'quantidade'] },
  { name: 'estoque_produto', module: 'SIGAEST', keywords: ['produto', 'cadastro do produto', 'item', 'descrição do produto', 'detalhe do produto'] },
  { name: 'compras_pedido', module: 'SIGACOM', keywords: ['compra', 'fornecedor', 'pedido de compra', 'sc7', 'atrasado', 'compras'] },
  { name: 'fiscal_nf', module: 'SIGAFIS', keywords: ['nota fiscal emitida', 'notas fiscais', 'nf emitida', 'nfs emitidas', 'chave nfe', 'livro fiscal', 'livros fiscais', 'tes', 'itens da nota', 'itens nf'] },
  { name: 'contabil_dados', module: 'SIGACTB', keywords: ['contabilidade', 'contabil', 'lancamento contabil', 'lancamentos contabeis', 'balancete', 'plano de contas', 'razão contábil', 'centro de custo'] },
]

function classify(question = '', module = '') {
  const q = String(question).toLowerCase(); 
  const mod = String(module || '').toUpperCase();
  for (const intent of INTENTS) { 
    const byModule = mod && mod === intent.module; 
    const byKeyword = intent.keywords.some(k => q.includes(k)); 
    if (byModule || byKeyword) {
      return { name: intent.name, confidence: byModule ? 0.88 : 0.82, strategy: 'heuristic' }
    }
  }
  return { name: 'geral', confidence: 0.42, strategy: 'ai_fallback' }
}

function extractEntities(question = '', screenText = '') {
  const q = String(question);
  const st = String(screenText);
  const entities = {};
  
  // Procura por códigos de 6 dígitos no prompt do usuario (IDs padrão Protheus)
  const code6 = q.match(/\b(\d{6})\b/);
  
  if (q.match(/\b(?:pedido)\b/i) && code6) entities.pedido = code6[1];
  else if (q.match(/\b(?:cliente)\b/i) && code6) entities.cliente = code6[1];
  else if (q.match(/\b(?:fornecedor)\b/i) && code6) entities.fornecedor = code6[1];
  else if (code6) {
    // Fallback genérico se não tiver a palavra chave junto
    entities.pedido = code6[1];
    entities.cliente = code6[1];
  }

  // Produto (Alfanumérico 4 a 15 chars) no prompt
  const prodMatch = q.match(/\b(?:produto|item)\s*[:#-]?\s*([A-Za-z0-9]{4,15})\b/i);
  if (prodMatch) entities.produto = prodMatch[1].toUpperCase();

  // Filial (Branch) - Código alfanumérico ou numérico ex: "filial 01", "branch 0101"
  const filialMatch = q.match(/\b(?:filial|branch)\s*[:#-]?\s*([A-Za-z0-9]{2,6})\b/i);
  if (filialMatch) entities.branch = filialMatch[1];

  // Extração de Datas (DD/MM/YYYY ou YYYYMMDD ou YYYY-MM-DD)
  // Útil para buscar dtDe e dtAte para Fiscal e Contábil
  const dateRegex = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{8})\b/g;
  const datesFound = q.match(dateRegex);
  if (datesFound && datesFound.length > 0) {
    const parseDate = (dStr) => {
      let d = dStr.replace(/[\/\-]/g, '');
      if (d.length === 8) {
        // Se começar com Dia ex: 31122026 -> 20261231
        if (dStr.includes('/') && dStr.indexOf('/') === 2) {
           return `${d.substring(4, 8)}${d.substring(2, 4)}${d.substring(0, 2)}`;
        }
        // Já está no formato YYYYMMDD (ou próximo disso)
        if (d.startsWith('20')) return d; 
      }
      return d;
    };
    entities.dtDe = parseDate(datesFound[0]);
    if (datesFound.length > 1) {
      entities.dtAte = parseDate(datesFound[1]);
    }
  }

  // Se nao achou no prompt, tenta procurar de forma estruturada no texto da tela
  if (st) {
    if (!entities.cliente) {
      const screenCli = st.match(/\bcliente\s*[:#-]?\s*([A-Za-z0-9]{6})\b/i);
      if (screenCli) entities.cliente = screenCli[1].toUpperCase();
    }
    if (!entities.pedido) {
      const screenPed = st.match(/\bpedido\s*[:#-]?\s*([A-Za-z0-9]{6})\b/i);
      if (screenPed) entities.pedido = screenPed[1].toUpperCase();
    }
    if (!entities.fornecedor) {
      const screenForn = st.match(/\bfornecedor\s*[:#-]?\s*([A-Za-z0-9]{6})\b/i);
      if (screenForn) entities.fornecedor = screenForn[1].toUpperCase();
    }
    if (!entities.branch) {
      const screenFilial = st.match(/\bfilial\s*[:#-]?\s*([A-Za-z0-9]{2,6})\b/i);
      if (screenFilial) entities.branch = screenFilial[1];
    }
  }

  return entities;
}

module.exports = { INTENTS, classify, extractEntities }

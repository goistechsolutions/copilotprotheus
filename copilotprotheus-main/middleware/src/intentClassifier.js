const INTENTS = [
  { name: 'faturamento_pedido', module: 'SIGAFAT', keywords: ['pedido de venda', 'pedido', 'nota fiscal', 'faturado', 'status do pedido'] },
  { name: 'faturamento_cliente', module: 'SIGAFAT', keywords: ['cliente', 'limite de crédito', 'limite de credito', 'risco', 'cadastro de cliente'] },
  { name: 'financeiro_receber', module: 'SIGAFIN', keywords: ['titulo', 'títulos', 'financeiro', 'inadimplencia', 'vencido', 'contas a receber', 'recebimento'] },
  { name: 'financeiro_pagar', module: 'SIGAFIN', keywords: ['contas a pagar', 'pagamento', 'fornecedor a pagar'] },
  { name: 'estoque_saldo', module: 'SIGAEST', keywords: ['saldo', 'estoque', 'ruptura', 'mínimo', 'minimo', 'quantidade'] },
  { name: 'estoque_produto', module: 'SIGAEST', keywords: ['produto', 'cadastro do produto', 'item', 'descrição do produto'] },
  { name: 'compras_pedido', module: 'SIGACOM', keywords: ['compra', 'fornecedor', 'pedido de compra', 'sc7', 'atrasado'] },
  { name: 'fiscal_nf', module: 'SIGAFIS', keywords: ['nota fiscal emitida', 'notas fiscais', 'nf emitida', 'nfs emitidas', 'chave nfe', 'livro fiscal', 'livros fiscais', 'tes', 'itens da nota', 'itens nf'] },
  { name: 'contabil_dados', module: 'SIGACTB', keywords: ['contabilidade', 'contabil', 'lancamento contabil', 'lancamentos contabeis', 'balancete', 'plano de contas', 'razão contábil', 'centro de custo'] },
]
function classify(question = '', module = '') {
  const q = String(question).toLowerCase(); const mod = String(module || '').toUpperCase();
  for (const intent of INTENTS) { const byModule = mod && mod === intent.module; const byKeyword = intent.keywords.some(k => q.includes(k)); if (byModule || byKeyword) return { name: intent.name, confidence: byModule ? 0.88 : 0.82, strategy: 'heuristic' } }
  return { name: 'geral', confidence: 0.42, strategy: 'ai_fallback' }
}

function extractEntities(question = '', screenText = '') {
  const q = String(question);
  const st = String(screenText);
  const entities = {};
  
  // Procura por códigos de 6 dígitos no prompt do usuario
  const code6 = q.match(/\b(\d{6})\b/);
  
  if (q.match(/\b(?:pedido)\b/i) && code6) entities.pedido = code6[1];
  else if (q.match(/\b(?:cliente)\b/i) && code6) entities.cliente = code6[1];
  else if (q.match(/\b(?:fornecedor)\b/i) && code6) entities.fornecedor = code6[1];
  else if (code6) {
    entities.pedido = code6[1];
    entities.cliente = code6[1];
  }

  // Produto (Alfanumérico) no prompt
  const prodMatch = q.match(/\b(?:produto|item)\s*[:#-]?\s*([A-Za-z0-9]{4,15})\b/i);
  if (prodMatch) entities.produto = prodMatch[1].toUpperCase();

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
  }

  return entities;
}

module.exports = { INTENTS, classify, extractEntities }

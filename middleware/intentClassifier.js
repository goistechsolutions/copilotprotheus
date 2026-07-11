// middleware/intentClassifier.js  — heuristica + fallback LLM real
const axios = require("axios");
const BACKEND_URL = process.env.BACKEND_URL || "";

const KEYWORDS = {
  analise_faturamento: ["venda","pedido de venda","sc5","sc6","sc9","faturado","nao faturado","liberado","bloqueio","faturamento","nota de saida","sf2","sd2","fechado","rejeitado","denegado"],
  financeiro:          ["titulo","inadimplencia","vencido","receber","pagar","fluxo de caixa","se1","se2","se5"],
  estoque:             ["saldo","lote","enderecamento","estoque","ruptura","produto","sb2","sb8","sbf","minimo","disponivel"],
  compras:             ["compra","fornecedor","sc7","pedido de compra","atraso","sc1", "nota de entrada", "sf1","sd1"],
};
const MODULE_MAP = { SIGAFAT:"analise_faturamento", SIGAFIN:"financeiro", SIGAEST:"estoque", SIGACOM:"compras" };

function heuristicClassify(question, module) {
  const q = question.toLowerCase();
  let best = null, bestScore = 0;
  for (const [intent, kws] of Object.entries(KEYWORDS)) {
    const s = kws.filter(k => q.includes(k)).length;
    if (s > bestScore) { bestScore = s; best = intent; }
  }
  if (!bestScore && module && MODULE_MAP[module]) best = MODULE_MAP[module];
  return { intent: best, score: bestScore, source: "heuristic" };
}

async function llmClassify(question) {
  try {
    const r = await axios.post(BACKEND_URL + "/api/classify", { question }, { timeout: 5000 });
    if (r.data && r.data.intent) return { intent: r.data.intent, score: 1, source: "llm" };
  } catch {}
  return null;
}

async function classifyIntent(question, module) {
  const h = heuristicClassify(question, module);
  if (h.score >= 1) return h;
  const llm = await llmClassify(question);
  if (llm) return llm;
  return { intent: "geral", score: 0, source: "fallback" };
}

module.exports = { classifyIntent };

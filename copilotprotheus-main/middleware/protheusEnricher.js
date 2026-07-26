// middleware/protheusEnricher.js  — Promise.all + cache
const protheusClient = require("./protheusClient");
const cacheService   = require("./cache/cacheService");

async function enrichContext(intent, context) {
  const cached = cacheService.get(intent, context);
  if (cached) return cached;

  let result = {};
  const f = (url, params) => protheusClient.get(url, params).catch(() => null);

  if (intent === "analise_faturamento") {
    const [pedidos, itens] = await Promise.all([
      f("/rest/pedidos",     { filial: context.branch, pedido: context.pedido }),
      f("/rest/itenspedido", { filial: context.branch, pedido: context.pedido }),
    ]);
    result = { pedidos, itensPedido: itens };
  } else if (intent === "financeiro") {
    const [titulos] = await Promise.all([f("/rest/titulos", { filial: context.branch, vencidos: "S" })]);
    result = { titulos };
  } else if (intent === "estoque") {
    const [saldo] = await Promise.all([f("/rest/saldo", { filial: context.branch, produto: context.produto })]);
    result = { saldo };
  } else if (intent === "compras") {
    const [compras] = await Promise.all([f("/rest/compras", { filial: context.branch, fornecedor: context.fornecedor })]);
    result = { compras };
  }

  cacheService.set(intent, context, result);
  return result;
}

module.exports = { enrichContext };

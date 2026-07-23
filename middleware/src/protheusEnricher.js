const protheus = require('./protheusClient')
const logger = require('./logger')

/**
 * Enriquece o contexto com dados do Protheus.
 * Executa consultas em paralelo via Promise.allSettled para resiliência.
 */
async function enrich(intent, context) {
  const data = {}
  const tasks = []

  // Extrai filial e range de datas unificado
  const f = context.branch
  const { dtDe, dtAte } = getDateRange(context)

  switch (intent.name) {
    case 'faturamento_pedido':
      if (context.pedido) {
        tasks.push({ key: 'status_pedido', promise: protheus.getPedido(context.pedido, context).then(r => r.data) })
        tasks.push({ key: 'itens_pedido', promise: protheus.getItensPedido(context.pedido, context).then(r => r.data) })
      }
      break

    case 'faturamento_cliente':
      if (context.cliente) {
        tasks.push({ key: 'cadastro_cliente', promise: protheus.getCliente(context.cliente, context).then(r => r.data) })
        tasks.push({ key: 'titulos_receber', promise: protheus.getTitulos(context.cliente, context).then(r => r.data) })
      }
      break

    case 'financeiro_receber':
      if (context.cliente) {
        tasks.push({ key: 'titulos_receber', promise: protheus.getTitulos(context.cliente, context).then(r => r.data) })
      }
      break
      
    case 'financeiro_pagar':
      if (context.fornecedor) {
        tasks.push({ key: 'titulos_pagar', promise: protheus.custom('/TitulosPagarRest', { fornecedor: context.fornecedor }, context).then(r => r.data) })
      }
      break

    case 'estoque_saldo':
    case 'estoque_produto':
      if (context.produto) {
        tasks.push({ key: 'produto_info', promise: protheus.getProduto(context.produto, context).then(r => r.data) })
        tasks.push({ key: 'saldo', promise: protheus.getSaldo(context.produto, f, context).then(r => r.data) })
      }
      break

    case 'compras_pedido':
      if (context.fornecedor) {
        tasks.push({ key: 'compras', promise: protheus.custom('/ComprasRest', { fornecedor: context.fornecedor, filial: f }, context).then(r => r.data) })
      }
      break

    case 'fiscal_nf':
      tasks.push({ key: 'nfs_emitidas', promise: protheus.getNfsEmitidas(dtDe, dtAte, f, context).then(r => r.data) })
      tasks.push({ key: 'itens_fiscais', promise: protheus.getItensNf(dtDe, dtAte, f, context).then(r => r.data) })
      tasks.push({ key: 'livros_fiscais', promise: protheus.getLivrosFiscais(dtDe, dtAte, f, context).then(r => r.data) })
      break

    case 'contabil_dados':
      tasks.push({ key: 'lancamentos_contabeis', promise: protheus.getLancamentosContabeis(dtDe, dtAte, f, context).then(r => r.data) })
      tasks.push({ key: 'balancete', promise: protheus.getBalancete(dtDe, dtAte, f, context).then(r => r.data) })
      tasks.push({ key: 'plano_contas', promise: protheus.getPlanoContas(f, context).then(r => r.data) })
      break
  }

  function getDateRange(ctx) {
    // Se o Classificador encontrou dtDe e dtAte no texto, usa eles
    if (ctx.dtDe && ctx.dtAte) {
      return { dtDe: ctx.dtDe, dtAte: ctx.dtAte }
    }
    if (ctx.dtDe && !ctx.dtAte) {
       // Se o usuario passou só um dia (ex: "notas do dia 15/05/2026")
       return { dtDe: ctx.dtDe, dtAte: ctx.dtDe }
    }
    
    // Fallback: Retorna YYYYMMDD para os últimos 30 dias
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const format = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
    
    return {
      dtDe: format(thirtyDaysAgo),
      dtAte: format(today)
    }
  }

  if (tasks.length === 0) return data

  try {
    // Executa em paralelo capturando erros individuais (allSettled)
    const results = await Promise.allSettled(tasks.map(t => t.promise))
    for (let i = 0; i < tasks.length; i++) {
      const result = results[i]
      const task = tasks[i]
      if (result.status === 'fulfilled') {
        data[task.key] = result.value
        logger.info(`Enriquecido com sucesso: ${task.key} (intent=${intent.name})`)
      } else {
        logger.warn(`Enrich parcial falhou: ${task.key} err=${result.reason?.message || result.reason}`)
        data[`${task.key}_error`] = result.reason?.message || String(result.reason)
      }
    }
  } catch (e) {
    logger.warn(`Enrich crítico falhou intent=${intent.name} err=${e.message}`)
    data.enrich_error = e.message
  }

  return data
}

module.exports = { enrich }

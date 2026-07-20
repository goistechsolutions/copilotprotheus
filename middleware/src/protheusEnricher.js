const protheus = require('./protheusClient')
const logger = require('./logger')

/**
 * Enriquece o contexto com dados do Protheus.
 * Executa consultas em paralelo via Promise.allSettled para resiliência.
 */
async function enrich(intent, context) {
  const data = {}
  const tasks = []

  switch (intent.name) {
    case 'faturamento_pedido':
      if (context.pedido) {
        const [st, it] = await Promise.allSettled([
          protheus.getPedido(context.pedido, context),
          protheus.getItensPedido(context.pedido, context)
        ])
        if (st.status === 'fulfilled') data.status_pedido = st.value.data
        if (it.status === 'fulfilled') data.itens_pedido = it.value.data
      }
      break

    case 'faturamento_cliente':
      if (context.cliente) {
        const [cli, tit] = await Promise.allSettled([
          protheus.getCliente(context.cliente, context),
          protheus.getTitulos(context.cliente, context)
        ])
        if (cli.status === 'fulfilled') data.cadastro_cliente = cli.value.data
        if (tit.status === 'fulfilled') data.titulos_receber = tit.value.data
      }
      break

    case 'financeiro_receber':
      if (context.cliente) {
        tasks.push({ key: 'titulos_receber', promise: protheus.getTitulos(context.cliente, context).then(r => r.data) })
      }
      break
      
    case 'financeiro_pagar':
      if (context.fornecedor) {
        tasks.push({ key: 'titulos_pagar', promise: protheus.custom('/TitulosPagarRest', { fornecedor: context.fornecedor }, context).then(r => r.data).catch(() => null) })
      }
      break

    case 'estoque_saldo':
    case 'estoque_produto':
      if (context.produto) {
        tasks.push({ key: 'produto_info', promise: protheus.getProduto(context.produto, context).then(r => r.data) })
        tasks.push({ key: 'saldo', promise: protheus.getSaldo(context.produto, context.branch, context).then(r => r.data) })
      }
      break

    case 'compras_pedido':
      if (context.fornecedor) {
        tasks.push({ key: 'compras', promise: protheus.custom('/ComprasRest', { fornecedor: context.fornecedor, filial: context.branch }, context).then(r => r.data) })
      }
      break

    case 'fiscal_nf':
      {
        const { dtDe, dtAte } = getDateRange(context)
        const f = context.branch
        tasks.push({ key: 'nfs_emitidas', promise: protheus.getNfsEmitidas(dtDe, dtAte, f, context).then(r => r.data).catch(() => null) })
        tasks.push({ key: 'itens_fiscais', promise: protheus.getItensNf(dtDe, dtAte, f, context).then(r => r.data).catch(() => null) })
        tasks.push({ key: 'livros_fiscais', promise: protheus.getLivrosFiscais(dtDe, dtAte, f, context).then(r => r.data).catch(() => null) })
      }
      break

    case 'contabil_dados':
      {
        const { dtDe, dtAte } = getDateRange(context)
        const f = context.branch
        tasks.push({ key: 'lancamentos_contabeis', promise: protheus.getLancamentosContabeis(dtDe, dtAte, f, context).then(r => r.data).catch(() => null) })
        tasks.push({ key: 'balancete', promise: protheus.getBalancete(dtDe, dtAte, f, context).then(r => r.data).catch(() => null) })
        tasks.push({ key: 'plano_contas', promise: protheus.getPlanoContas(f, context).then(r => r.data).catch(() => null) })
      }
      break
  }

  function getDateRange(ctx) {
    // Retorna YYYYMMDD para os últimos 30 dias se não fornecido
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)

    const format = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
    
    return {
      dtDe: ctx.dtDe || ctx.cDtDe || format(thirtyDaysAgo),
      dtAte: ctx.dtAte || ctx.cDtAte || format(today)
    }
  }

  if (tasks.length === 0) return data

  try {
    const results = await Promise.allSettled(tasks.map(t => t.promise))
    for (let i = 0; i < tasks.length; i++) {
      const result = results[i]
      const task = tasks[i]
      if (result.status === 'fulfilled') {
        data[task.key] = result.value
        logger.info(`Enriquecido: ${task.key} (intent=${intent.name})`)
      } else {
        logger.warn(`Enrich parcial falhou: ${task.key} err=${result.reason?.message || result.reason}`)
        data[`${task.key}_error`] = result.reason?.message || String(result.reason)
      }
    }
  } catch (e) {
    logger.warn(`Enrich falhou intent=${intent.name} err=${e.message}`)
    data.enrich_error = e.message
  }

  return data
}

module.exports = { enrich }

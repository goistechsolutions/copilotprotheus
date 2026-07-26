const router = require('express').Router()
const protheus = require('../protheusClient')
const logger = require('../logger')
const cache = require('../cache')

// --- FATURAMENTO / PEDIDOS ---

router.get('/pedido', async (req, res) => {
  const { pedido } = req.query
  if (!pedido) return res.status(400).json({ error: 'Informe o numero do pedido.' })
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'faturamento', `pedido:${pedido}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getPedido(pedido, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/pedido err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/itens-pedido', async (req, res) => {
  const { pedido } = req.query
  if (!pedido) return res.status(400).json({ error: 'Informe o numero do pedido.' })
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'faturamento', `itens-pedido:${pedido}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getItensPedido(pedido, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/itens-pedido err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- ESTOQUE ---

router.get('/saldo', async (req, res) => {
  const { produto, filial } = req.query
  if (!produto) return res.status(400).json({ error: 'Informe o produto.' })
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  const key = cache.buildKey(ctx, 'estoque', `saldo:${produto}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'estoque', () =>
      protheus.getSaldo(produto, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/saldo err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/produto', async (req, res) => {
  const { codigo } = req.query
  if (!codigo) return res.status(400).json({ error: 'Informe o codigo do produto.' })
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'estoque', `produto:${codigo}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'estoque', () =>
      protheus.getProduto(codigo, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/produto err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- FINANCEIRO ---

router.get('/titulos', async (req, res) => {
  const { cliente } = req.query
  if (!cliente) return res.status(400).json({ error: 'Informe o cliente.' })
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'financeiro', `titulos:${cliente}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'financeiro', () =>
      protheus.getTitulos(cliente, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/titulos err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- MÓDULO FISCAL ---

router.get('/nfs-emitidas', async (req, res) => {
  const { dtDe, dtAte, filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  if (!dtDe || !dtAte) return res.status(400).json({ error: 'Parâmetros dtDe e dtAte são obrigatórios (YYYYMMDD).' })
  const key = cache.buildKey(ctx, 'faturamento', `nfs-emitidas:${dtDe}:${dtAte}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getNfsEmitidas(dtDe, dtAte, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/nfs-emitidas err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/itens-nf', async (req, res) => {
  const { dtDe, dtAte, filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  if (!dtDe || !dtAte) return res.status(400).json({ error: 'Parâmetros dtDe e dtAte são obrigatórios (YYYYMMDD).' })
  const key = cache.buildKey(ctx, 'faturamento', `itens-nf:${dtDe}:${dtAte}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getItensNf(dtDe, dtAte, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/itens-nf err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/tes', async (req, res) => {
  const { codigo } = req.query
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'faturamento', `tes:${codigo || 'all'}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getTes(codigo, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/tes err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/livros-fiscais', async (req, res) => {
  const { dtDe, dtAte, filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  if (!dtDe || !dtAte) return res.status(400).json({ error: 'Parâmetros dtDe e dtAte são obrigatórios (YYYYMMDD).' })
  const key = cache.buildKey(ctx, 'faturamento', `livros-fiscais:${dtDe}:${dtAte}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'faturamento', () =>
      protheus.getLivrosFiscais(dtDe, dtAte, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/livros-fiscais err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- MÓDULO CONTÁBIL ---

router.get('/lancamentos', async (req, res) => {
  const { dtDe, dtAte, filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  if (!dtDe || !dtAte) return res.status(400).json({ error: 'Parâmetros dtDe e dtAte são obrigatórios (YYYYMMDD).' })
  const key = cache.buildKey(ctx, 'financeiro', `lancamentos:${dtDe}:${dtAte}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'financeiro', () =>
      protheus.getLancamentosContabeis(dtDe, dtAte, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/lancamentos err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/balancete', async (req, res) => {
  const { dtDe, dtAte, filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  if (!dtDe || !dtAte) return res.status(400).json({ error: 'Parâmetros dtDe e dtAte são obrigatórios (YYYYMMDD).' })
  const key = cache.buildKey(ctx, 'financeiro', `balancete:${dtDe}:${dtAte}:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'financeiro', () =>
      protheus.getBalancete(dtDe, dtAte, f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/balancete err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

router.get('/plano-contas', async (req, res) => {
  const { filial } = req.query
  const ctx = req.jwtPayload || {}
  const f = filial || ctx.branch || '0101'
  const key = cache.buildKey(ctx, 'financeiro', `plano-contas:${f}`)
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'financeiro', () =>
      protheus.getPlanoContas(f, ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/plano-contas err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- EXECUÇÃO DE SQL GENÉRICO ---

router.post('/query', async (req, res) => {
  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Parâmetro query é obrigatório no corpo.' })
  const ctx = req.jwtPayload || {}
  // Queries dinâmicas não usam cache fixo pois o resultado pode mudar instantaneamente
  try {
    const { data } = await protheus.executeQuery(query, ctx)
    res.json(data)
  } catch (e) {
    logger.error(`POST /protheus/query err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

// --- EMPRESAS E FILIAIS ---

router.get('/companies', async (req, res) => {
  const ctx = req.jwtPayload || {}
  const key = cache.buildKey(ctx, 'geral', 'companies:all')
  
  try {
    const { data, fromCache } = await cache.withCache(key, 'geral', () =>
      protheus.getCompanies(ctx).then(r => r.data)
    )
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS')
    res.json(data)
  } catch (e) {
    logger.error(`GET /protheus/companies err=${e.message}`)
    res.status(502).json({ error: e.message })
  }
})

module.exports = router

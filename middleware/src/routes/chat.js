const router = require('express').Router()
const backendClient = require('../backendClient')
const { classify, extractEntities } = require('../intentClassifier')
const { enrich } = require('../protheusEnricher')
const logger = require('../logger')

router.options('/ask', (_, res) => res.sendStatus(204))

router.post('/ask', async (req, res) => {
  const { question, enrich: shouldEnrich = true, context = {}, history = [] } = req.body || {}
  if (!question) return res.status(400).json({ error: 'Informe a pergunta.' })

  const ctx = {
    pedido: context.pedido || null,
    module: context.module || null,
    user: context.user || null,
    password: req.body.password || context.password || null,
    protheus_token: req.body.protheus_token || context.protheus_token || null,
    environment: context.environment || null,
    company: context.company || null,
    branch: context.branch || null,
    station: context.station || null,
    session_id: context.session_id || `mw-${Date.now()}`,
    cliente: context.cliente || null,
    produto: context.produto || null,
    fornecedor: context.fornecedor || null,
    screen_text: context.screen_text || null,
  }

  const entities = extractEntities(question, ctx.screen_text)
  ctx.pedido = ctx.pedido || entities.pedido
  ctx.cliente = ctx.cliente || entities.cliente
  ctx.produto = ctx.produto || entities.produto
  ctx.fornecedor = ctx.fornecedor || entities.fornecedor

  const intent = classify(question, ctx.module)
  logger.info(`intent=${intent.name} module=${ctx.module} user=${ctx.user} pedido=${ctx.pedido}`)

  ctx.tenant_id = req.jwtPayload.tenant_id || req.body.tenant_id || (context && context.tenant_id) || 'default'
  ctx.token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null

  let protheusData = {}
  if (shouldEnrich) protheusData = await enrich(intent, ctx)

  const payload = {
    question,
    intent: intent.name,
    intent_description: intent.description,
    ...ctx,
    tenant_id: ctx.tenant_id,
    protheus_data: protheusData,
    history,
  }

  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null
    const { data } = await backendClient.ask(payload, token)
    res.json({ ...data, intent: intent.name })
  } catch (e) {
    logger.error(`POST /chat/ask backend err=${e.message}`)
    res.status(502).json({ error: 'Falha ao conectar no backend', detail: e.message })
  }
})

router.options('/stream', (_, res) => res.sendStatus(204))

router.post('/stream', async (req, res) => {
  const { question, enrich: shouldEnrich = true, context = {}, history = [] } = req.body || {}
  if (!question) return res.status(400).json({ error: 'Informe a pergunta.' })

  const ctx = {
    pedido: context.pedido || null,
    module: context.module || null,
    user: context.user || null,
    password: req.body.password || context.password || null,
    protheus_token: req.body.protheus_token || context.protheus_token || null,
    environment: context.environment || null,
    company: context.company || null,
    branch: context.branch || null,
    station: context.station || null,
    session_id: context.session_id || `mw-${Date.now()}`,
    cliente: context.cliente || null,
    produto: context.produto || null,
    fornecedor: context.fornecedor || null,
    screen_text: context.screen_text || null,
  }

  const entities = extractEntities(question, ctx.screen_text)
  ctx.pedido = ctx.pedido || entities.pedido
  ctx.cliente = ctx.cliente || entities.cliente
  ctx.produto = ctx.produto || entities.produto
  ctx.fornecedor = ctx.fornecedor || entities.fornecedor

  const intent = classify(question, ctx.module)
  logger.info(`stream intent=${intent.name} module=${ctx.module} user=${ctx.user} pedido=${ctx.pedido}`)

  ctx.tenant_id = req.jwtPayload.tenant_id || req.body.tenant_id || (context && context.tenant_id) || 'default'
  ctx.token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null

  let protheusData = {}
  if (shouldEnrich) protheusData = await enrich(intent, ctx)

  const payload = {
    question,
    intent: intent.name,
    intent_description: intent.description,
    ...ctx,
    tenant_id: ctx.tenant_id,
    protheus_data: protheusData,
    history,
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null
    const responseStream = await backendClient.askStream(payload, token)
    responseStream.data.pipe(res)
  } catch (e) {
    logger.error(`POST /chat/stream backend err=${e.message}`)
    res.write(`data: ${JSON.stringify({ error: 'Falha ao conectar no backend', detail: e.message })}\n\n`)
    res.end()
  }
})

router.get('/intents', (_, res) => {
  const { INTENTS } = require('../intentClassifier')
  res.json(INTENTS.map(i => ({ name: i.name, module: i.module, description: i.description })))
})

module.exports = router

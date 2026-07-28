require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const logger = require('./logger')
const { jwtAuth, generateToken } = require('./jwtAuth')
const protheusRoutes = require('./routes/protheus')
const chatRoutes = require('./routes/chat')
const reportRoutes = require('./routes/report')
const apiRoutes = require('./routes/api')

const app = express()
const PORT = process.env.PORT || 3001
const http = require('http')

// --- Proxy para o Adminer (Gerenciador de Banco de Dados) ---
// Registrado ANTES de qualquer middleware de segurança (como o Helmet)
// para podermos controlar 100% os cabeçalhos de X-Frame-Options e CSP.
app.use('/adminer', (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/adminer/, '') || '/'
  const options = {
    hostname: 'adminer',
    port: 8080,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers }
  }
  delete options.headers.host
  
  // Sobrescreve o writeHead do Express localmente para interceptar e remover os cabeçalhos bloqueadores
  const originalWriteHead = res.writeHead
  res.writeHead = function (statusCode, headers) {
    const cleanHeaders = headers ? { ...headers } : {}
    for (const key of Object.keys(cleanHeaders)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'x-frame-options' || lowerKey === 'content-security-policy') {
        delete cleanHeaders[key]
      }
    }
    res.removeHeader('x-frame-options')
    res.removeHeader('content-security-policy')
    res.removeHeader('X-Frame-Options')
    res.removeHeader('Content-Security-Policy')
    return originalWriteHead.call(this, statusCode, cleanHeaders)
  }

  const proxyReq = http.request(options, (proxyRes) => {
    if (proxyRes.headers.location && proxyRes.headers.location.startsWith('/')) {
      proxyRes.headers.location = '/adminer' + proxyRes.headers.location
    }
    
    // Clona os cabeçalhos para evitar propriedades readonly
    const responseHeaders = { ...proxyRes.headers }
    for (const key of Object.keys(responseHeaders)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'x-frame-options' || lowerKey === 'content-security-policy') {
        delete responseHeaders[key]
      }
    }
    
    res.writeHead(proxyRes.statusCode, responseHeaders)
    proxyRes.pipe(res, { end: true })
  })
  
  req.pipe(proxyReq, { end: true })
  
  proxyReq.on('error', (err) => {
    logger.error(`Erro no proxy do Adminer: ${err.message}`)
    res.status(502).send('Erro no proxy do Adminer: ' + err.message)
  })
})

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(helmet({
  frameguard: false,
  contentSecurityPolicy: false
}))
app.use(express.json())
app.use(morgan('combined'))
app.use(rateLimit({ windowMs: 60000, max: 60, message: { error: 'Rate limit excedido.' } }))

// --- Rota pública: gerar token JWT (dev/test) ---
app.post('/auth/token', (req, res) => {
  const { user, module, tenant_id } = req.body || {}
  
  if (!user || !tenant_id) {
    return res.status(400).json({ error: 'Os campos "user" e "tenant_id" são obrigatórios.' })
  }
  
  const token = generateToken({ 
    user, 
    module: module || null,
    tenant_id
  })
  res.json({ token, expires_in: parseInt(process.env.JWT_EXPIRY_SECONDS || '3600', 10) })
})

// --- Proxy público para a rota de launch do backend ---
const axios = require('axios')
app.get('/api/launch', async (req, res) => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000'
    const response = await axios.get(`${backendUrl}/api/launch`, {
      params: req.query,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    })
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      return res.redirect(response.headers.location)
    }
    res.status(response.status).send(response.data)
  } catch (e) {
    if (e.response && e.response.status >= 300 && e.response.status < 400 && e.response.headers.location) {
      return res.redirect(e.response.headers.location)
    }
    const status = e.response?.status || 502
    res.status(status).send(e.response?.data || e.message)
  }
})

// --- Rota pública de Health Check (encaminha para o backend) ---
app.get('/health', async (req, res) => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000'
    const response = await axios.get(`${backendUrl}/health`)
    res.json(response.data)
  } catch (e) {
    res.status(500).json({ status: 'error', database: 'unhealthy', error: e.message })
  }
})

// --- Rotas protegidas por JWT ---
app.use('/protheus', jwtAuth, protheusRoutes)
app.use('/chat', jwtAuth, chatRoutes)
app.use('/report', jwtAuth, reportRoutes)
app.use('/api', jwtAuth, apiRoutes)

try {
  const { stats: cacheStats } = require('../cache/cacheService')
  app.get('/health-cache', (_, res) => res.json({ 
    status: 'ok', 
    ts: new Date().toISOString(),
    cache: cacheStats ? cacheStats() : {}
  }))
} catch (e) {
  console.warn('Modulo de cache nao carregado:', e.message)
}

// --- Fallback/Proxy para o Frontend React (Nginx) ---
app.use((req, res, next) => {
  const options = {
    hostname: 'frontend',
    port: 80,
    path: req.url,
    method: req.method,
    headers: { ...req.headers }
  }
  delete options.headers['host']
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  
  proxyReq.on('error', (err) => {
    logger.error(`Erro no proxy do frontend: ${err.message}`)
    next()
  })
  
  req.pipe(proxyReq, { end: true })
})

app.use((err, req, res, next) => {
  logger.error(`Unhandled: ${err.message}`)
  res.status(500).json({ error: 'Erro interno no middleware.' })
})

app.listen(PORT, () => logger.info(`Middleware rodando em http://localhost:${PORT}`))
module.exports = app

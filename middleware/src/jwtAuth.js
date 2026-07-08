const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'copilot-protheus-dev-secret-change-me'
const JWT_EXPIRY_SECONDS = parseInt(process.env.JWT_EXPIRY_SECONDS || '3600', 10)

/**
 * Gera um token JWT usando a biblioteca jsonwebtoken (HMAC-SHA256).
 */
function generateToken(payload = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY_SECONDS })
}

/**
 * Middleware Express que valida Bearer tokens JWT.
 * Rejeita com 401 se token ausente, expirado ou inválido.
 */
function jwtAuth(req, res, next) {
  // Permite acesso irrestrito se o X-Admin-Key estiver correto (usado pelo AdminDashboard)
  const adminKey = req.headers['x-admin-key']
  if (adminKey && adminKey === JWT_SECRET) {
    req.jwtPayload = { user: 'admin', role: 'admin' }
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token JWT ausente. Envie Authorization: Bearer <token> ou a chave X-Admin-Key' })
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.jwtPayload = decoded
    next()
  } catch (e) {
    let msg = 'Token inválido'
    if (e.name === 'TokenExpiredError') {
      msg = 'Token expirado'
    } else if (e.name === 'JsonWebTokenError') {
      msg = `Token inválido: ${e.message}`
    }
    return res.status(401).json({ error: msg })
  }
}

module.exports = { jwtAuth, generateToken }

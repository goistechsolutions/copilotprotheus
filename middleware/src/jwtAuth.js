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
  // Permite acesso irrestrito se o X-Admin-Key estiver correto (usado pelo AdminDashboard ou Server-to-Server)
  const adminKey = req.headers['x-admin-key']
  if (adminKey && adminKey === JWT_SECRET) {
    req.jwtPayload = { 
      user: req.headers['x-admin-user'] || 'system', 
      role: req.headers['x-admin-role'] || 'admin',
      tenantId: req.headers['x-tenant-id'] || 'default'
    }
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente ou mal formatado.' })
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.jwtPayload = decoded
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' })
  }
}

module.exports = { jwtAuth, generateToken }

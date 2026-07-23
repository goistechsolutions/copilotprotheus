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
  const requestTenant = req.headers['x-tenant-id']
  const isMultiTenantStrict = process.env.TENANT_HEADER_REQUIRED === 'true'

  if (adminKey && adminKey === JWT_SECRET) {
    if (isMultiTenantStrict && !requestTenant) {
      return res.status(401).json({ error: 'x-tenant-id obrigatório em requisições server-to-server (modo estrito).' })
    }
    req.jwtPayload = { 
      user: req.headers['x-admin-user'] || 'system', 
      role: req.headers['x-admin-role'] || 'admin',
      tenantId: requestTenant || 'default'
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
    
    // Suporte JWT do FastAPI envia tenant_id, Token de Teste envia tenantId
    const resolvedTenant = decoded.tenant_id || decoded.tenantId
    
    if (isMultiTenantStrict && !resolvedTenant) {
      return res.status(401).json({ error: 'O token fornecido não possui tenant_id, necessário em modo estrito.' })
    }
    
    if (isMultiTenantStrict && requestTenant && resolvedTenant !== requestTenant && resolvedTenant !== 'public') {
      return res.status(403).json({ error: 'Acesso negado: o token pertence a outro tenant_id.' })
    }
    
    req.jwtPayload = decoded
    req.jwtPayload.tenantId = resolvedTenant || 'default'
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' })
  }
}

module.exports = { jwtAuth, generateToken }

const NodeCache = require('node-cache')

// TTL por intenção (em segundos) — dados mais voláteis têm TTL menor
const TTL_MAP = {
  faturamento: 30,   // pedidos mudam com frequência
  financeiro:  60,   // títulos: moderado
  estoque:     45,   // saldos: moderado
  compras:     60,   // pedidos de compra: moderado
  geral:       60,   // padrão
}

const DEFAULT_TTL_SEC = 45

const store = new NodeCache({ 
  stdTTL: DEFAULT_TTL_SEC, 
  checkperiod: 60, 
  useClones: false 
})

/**
 * Monta chave de cache determinística de forma robusta.
 */
function cacheKey(...parts) {
  return parts.filter(Boolean).join(':').toLowerCase()
}

/**
 * Monta chave de cache estruturada baseada no contexto.
 */
function buildKey(ctx = {}, intent = 'geral', extra = '') {
  const parts = [
    intent,
    ctx.company || 'default',
    ctx.branch  || 'default',
    ctx.module  || 'default',
    extra,
  ]
  return parts.filter(Boolean).join(':').replace(/\s+/g, '_').toLowerCase()
}

/**
 * Retorna valor do cache.
 */
function get(key) {
  return store.get(key)
}

/**
 * Salva valor no cache com TTL em segundos (padrão) ou milissegundos.
 */
function set(key, value, ttlSec = DEFAULT_TTL_SEC) {
  // Se for passado TTL em milissegundos (valores maiores que 100000), converte para segundos
  const finalTtl = ttlSec > 100000 ? Math.floor(ttlSec / 1000) : ttlSec
  store.set(key, value, finalTtl)
}

/**
 * Invalida chave específica.
 */
function invalidate(key) {
  store.del(key)
}

/**
 * Invalida chaves por prefixo.
 */
function invalidateByPrefix(prefix) {
  const keys = store.keys().filter(k => k.startsWith(prefix.toLowerCase()))
  store.del(keys)
  return keys.length
}

/**
 * Tenta retornar do cache. Se miss, executa fn() e armazena o resultado.
 * fn deve retornar uma Promise.
 */
async function withCache(key, intent, fn) {
  const hit = store.get(key)
  if (hit !== undefined) {
    return { data: hit, fromCache: true }
  }
  const result = await fn()
  const ttl = TTL_MAP[intent] || DEFAULT_TTL_SEC
  store.set(key, result, ttl)
  return { data: result, fromCache: false }
}

/**
 * Limpa todo o cache.
 */
function clear() {
  store.flushAll()
}

/**
 * Tamanho atual do cache.
 */
function size() {
  return store.getStats().keys
}

/**
 * Estatísticas operacionais.
 */
function stats() {
  return store.getStats()
}

module.exports = { 
  get, 
  set, 
  clear, 
  size, 
  cacheKey, 
  buildKey, 
  invalidate, 
  invalidateByPrefix, 
  withCache, 
  stats 
}

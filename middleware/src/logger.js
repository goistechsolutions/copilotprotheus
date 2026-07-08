const level = process.env.LOG_LEVEL || 'info'
const enabled = { error: true, warn: true, info: true, debug: level === 'debug' }
function log(tag, args) { if (!enabled[tag]) return; const fn = tag === 'error' ? console.error : tag === 'warn' ? console.warn : console.log; fn(`[${tag.toUpperCase()}]`, ...args) }
module.exports = { error: (...args) => log('error', args), warn: (...args) => log('warn', args), info: (...args) => log('info', args), debug: (...args) => log('debug', args) }

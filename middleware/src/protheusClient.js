const axios = require('axios')
const https = require('https')
const backendClient = require('./backendClient')
require('dotenv').config()

const companyConfigCache = {}

async function getClientAndConfig(ctx = {}) {
  const tenantId = ctx.tenant_id || ctx.tenantId
  if (!tenantId || tenantId === 'default') {
    throw new Error('tenant_id explícito é obrigatório para comunicação com o Protheus.')
  }

  let baseURL = process.env.PROTHEUS_BASE_URL
  const accessToken = ctx.protheus_access_token || ctx.protheusAccessToken || null
  let comp = companyConfigCache[tenantId] || null

  if (!comp) {
    try {
      comp = await backendClient.getCompanyByTenant(tenantId, ctx.token || null)
      if (comp) companyConfigCache[tenantId] = comp
    } catch (e) {
      throw new Error(`Não foi possível obter a configuração do tenant ${tenantId}.`)
    }
  }

  baseURL = comp?.protheus_rest_url || baseURL
  if (!baseURL) {
    throw new Error('URL REST do Protheus não configurada para o tenant.')
  }
  if (!accessToken) {
    throw new Error('Access token do Protheus ausente. Use o gateway autenticado do backend.')
  }

  const cli = axios.create({
    baseURL,
    httpsAgent: new https.Agent({ rejectUnauthorized: true }),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  })

  cli.interceptors.response.use(
    res => res,
    err => {
      const remote = err.response?.data
      const msg = remote?.errorMessage || remote?.message || err.message || 'Erro Protheus'
      const normalized = new Error(String(msg).slice(0, 500))
      normalized.status = err.response?.status || 502
      normalized.detail = String(msg).slice(0, 500)
      return Promise.reject(normalized)
    }
  )

  return { cli, comp }
}

const getHeaders = (ctx = {}, comp = null) => {
  const c = comp?.protheus_empresa || ctx.company || ctx.company_code
  const b = comp?.protheus_filial || ctx.branch || ctx.filial
  if (!c || !b) {
    throw new Error('Empresa e filial explícitas são obrigatórias para a comunicação com o Protheus.')
  }
  return { headers: { TenantId: `${c},${b}` } }
}

const buildQuery = (params) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return q ? `?${q}` : ''
}

const requireBranch = (filial, comp, ctx) => {
  const value = filial || comp?.protheus_filial || ctx?.branch || ctx?.filial
  if (!value) throw new Error('Filial explícita é obrigatória para esta consulta.')
  return value
}

module.exports = {
  getPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    if (!pedido) throw new Error("Parâmetro 'pedido' é obrigatório.")
    return cli.get(`/PedidoStatus${buildQuery({ pedido })}`, getHeaders(ctx, comp))
  },
  getItensPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    if (!pedido) throw new Error("Parâmetro 'pedido' é obrigatório.")
    return cli.get(`/ItensPedidoRest${buildQuery({ pedido })}`, getHeaders(ctx, comp))
  },
  getCliente: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    if (!codigo) throw new Error("Parâmetro 'codigo' é obrigatório.")
    return cli.get(`/ClienteRest${buildQuery({ codigo })}`, getHeaders(ctx, comp))
  },
  getSaldo: async (produto, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/SaldoRest${buildQuery({ produto, filial: f })}`, getHeaders(ctx, comp))
  },
  getProduto: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    if (!codigo) throw new Error("Parâmetro 'codigo' é obrigatório.")
    return cli.get(`/ProdutoRest${buildQuery({ codigo })}`, getHeaders(ctx, comp))
  },
  getTitulos: async (cliente, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/TitulosRest${buildQuery({ cliente })}`, getHeaders(ctx, comp))
  },
  getNfsEmitidas: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/NfsEmitidasRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getItensNf: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/ItensNfRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getTes: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(null, comp, ctx)
    return cli.get(`/TesRest${buildQuery({ cFil: f, cCodigo: codigo })}`, getHeaders(ctx, comp))
  },
  getLivrosFiscais: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/LivrosFiscaisRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getLancamentosContabeis: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/LancamentosContabeisRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getBalancete: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/BalanceteRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getPlanoContas: async (filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = requireBranch(filial, comp, ctx)
    return cli.get(`/PlanoContasRest${buildQuery({ cFil: f })}`, getHeaders(ctx, comp))
  },
  executeQuery: async (query, ctx = {}) => {
    const tenantId = ctx.tenant_id || ctx.tenantId
    const environmentCode = ctx.environment_code || ctx.environmentCode || ctx.environment
    const companyId = ctx.company_id || ctx.companyId
    const module = ctx.module || ctx.modulo || ctx.module_code || ctx.moduleCode
    const branch = ctx.branch || ctx.filial
    const company = ctx.company || ctx.company_code || ctx.companyCode

    if (!tenantId || tenantId === 'default') {
      throw new Error('tenant_id explícito é obrigatório para executar QueryRest.')
    }
    if (!environmentCode || ['default', 'none', 'null'].includes(String(environmentCode).toLowerCase())) {
      throw new Error('environment_code explícito é obrigatório para executar QueryRest.')
    }
    if (!module || !branch || (!companyId && !company)) {
      throw new Error('módulo, empresa e filial explícitos são obrigatórios para executar QueryRest.')
    }

    return backendClient.queryRest({
      tenant_id: tenantId,
      environment_code: environmentCode,
      company_id: companyId,
      query,
      context: {
        tenant_id: tenantId,
        environment_code: environmentCode,
        module,
        branch,
        company,
        company_id: companyId,
        user: ctx.user || ctx.usuario,
        profile: ctx.profile || ctx.perfil
      }
    }, ctx.token || null)
  },
  getCompanies: async (ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get('../../api/framework/environment/v1/companies', getHeaders(ctx, comp))
  },
  custom: async (path, params, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`${path}${buildQuery(params)}`, getHeaders(ctx, comp))
  }
}

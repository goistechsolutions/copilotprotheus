const axios = require('axios')
const https = require('https')
const backendClient = require('./backendClient')
require('dotenv').config()

const companyConfigCache = {}

async function getClientAndConfig(ctx) {
  const tenantId = ctx?.tenant_id || 'default'
  let baseURL = process.env.PROTHEUS_BASE_URL
  let username = process.env.PROTHEUS_USER
  let password = process.env.PROTHEUS_PASSWORD
  let comp = null

  if (tenantId !== 'default') {
    if (companyConfigCache[tenantId]) {
      comp = companyConfigCache[tenantId]
      baseURL = comp.protheus_rest_url || baseURL
      username = comp.protheus_usuario || username
    } else {
      try {
        const token = ctx?.token || null
        comp = await backendClient.getCompanyByTenant(tenantId, token)
        if (comp) {
          companyConfigCache[tenantId] = comp
          baseURL = comp.protheus_rest_url || baseURL
          username = comp.protheus_usuario || username
        }
      } catch (e) {
        console.error(`Erro ao obter config do tenant ${tenantId}:`, e.message)
      }
    }
  }

  const cli = axios.create({
    baseURL: baseURL,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    auth: { username, password },
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
  })

  cli.interceptors.response.use(
    res => res,
    err => {
      const msg = err.response?.data?.errorMessage || err.message || 'Erro Protheus'
      return Promise.reject(new Error(msg))
    }
  )

  return { cli, comp }
}

const getHeaders = (ctx, comp = null) => {
  if (!ctx && !comp) return {};
  const c = comp?.protheus_empresa || ctx?.company || '01';
  const b = comp?.protheus_filial || ctx?.branch || '0101';
  return { headers: { 'TenantId': `${c},${b}` } };
};

module.exports = {
  getPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/PedidoStatus?pedido=${pedido}`, getHeaders(ctx, comp))
  },
  getSaldo: async (produto, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/SaldoRest?produto=${produto}&filial=${f}`, getHeaders(ctx, comp))
  },
  getTitulos: async (cliente, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/TitulosRest?cliente=${cliente}`, getHeaders(ctx, comp))
  },
  getProduto: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ProdutoRest?codigo=${codigo}`, getHeaders(ctx, comp))
  },
  getCliente: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ClienteRest?codigo=${codigo}`, getHeaders(ctx, comp))
  },
  getItensPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ItensPedidoRest?pedido=${pedido}`, getHeaders(ctx, comp))
  },
  
  // Fiscal
  getNfsEmitidas: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/NfsEmitidasRest?cDtDe=${dtDe}&cDtAte=${dtAte}&cFil=${f}`, getHeaders(ctx, comp))
  },
  getItensNf: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/ItensNfRest?cDtDe=${dtDe}&cDtAte=${dtAte}&cFil=${f}`, getHeaders(ctx, comp))
  },
  getTes: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/TesRest?cFil=${f}${codigo ? `&cCodigo=${codigo}` : ''}`, getHeaders(ctx, comp))
  },
  getLivrosFiscais: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/LivrosFiscaisRest?cDtDe=${dtDe}&cDtAte=${dtAte}&cFil=${f}`, getHeaders(ctx, comp))
  },
  
  // Contábil
  getLancamentosContabeis: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/LancamentosContabeisRest?cDtDe=${dtDe}&cDtAte=${dtAte}&cFil=${f}`, getHeaders(ctx, comp))
  },
  getBalancete: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/BalanceteRest?cDtDe=${dtDe}&cDtAte=${dtAte}&cFil=${f}`, getHeaders(ctx, comp))
  },
  getPlanoContas: async (filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/PlanoContasRest?cFil=${f}`, getHeaders(ctx, comp))
  },
  
  // Executador de Query Genérico
  executeQuery: async (query, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.post('/QueryRest', { query }, getHeaders(ctx, comp))
  },
  getCompanies: async (ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get('../../api/framework/environment/v1/companies', getHeaders(ctx, comp))
  },

  custom: async (path, params, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(path, { params, ...getHeaders(ctx, comp) })
  }
}

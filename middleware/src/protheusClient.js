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
  const c = comp?.protheus_empresa || ctx?.company;
  const b = comp?.protheus_filial || ctx?.branch;
  if (!c || !b) {
    throw new Error("Empresa (company) e Filial (branch) são obrigatórios para a comunicação com o Protheus. Verifique a configuração da Empresa no painel administrativo.");
  }
  return { headers: { 'TenantId': `${c},${b}` } };
};

// Helper for generating query strings safely
const buildQuery = (params) => {
  const q = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

module.exports = {
  // Comercial / Faturamento
  getPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    if (!pedido) throw new Error("Parâmetro 'pedido' é obrigatório.")
    return cli.get(`/PedidoStatus${buildQuery({ pedido })}`, getHeaders(ctx, comp))
  },
  getItensPedido: async (pedido, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ItensPedidoRest${buildQuery({ pedido })}`, getHeaders(ctx, comp))
  },
  getCliente: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ClienteRest${buildQuery({ codigo })}`, getHeaders(ctx, comp))
  },
  
  // Materiais / Estoque
  getSaldo: async (produto, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch;
    if (!f) throw new Error("Filial obrigatória para consultar saldo.");
    return cli.get(`/SaldoRest${buildQuery({ produto, filial: f })}`, getHeaders(ctx, comp))
  },
  getProduto: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/ProdutoRest${buildQuery({ codigo })}`, getHeaders(ctx, comp))
  },

  // Financeiro
  getTitulos: async (cliente, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    return cli.get(`/TitulosRest${buildQuery({ cliente })}`, getHeaders(ctx, comp))
  },

  // Fiscal
  getNfsEmitidas: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/NfsEmitidasRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getItensNf: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/ItensNfRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getTes: async (codigo, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/TesRest${buildQuery({ cFil: f, cCodigo: codigo })}`, getHeaders(ctx, comp))
  },
  getLivrosFiscais: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/LivrosFiscaisRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  
  // Contábil
  getLancamentosContabeis: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/LancamentosContabeisRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getBalancete: async (dtDe, dtAte, filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/BalanceteRest${buildQuery({ cDtDe: dtDe, cDtAte: dtAte, cFil: f })}`, getHeaders(ctx, comp))
  },
  getPlanoContas: async (filial, ctx) => {
    const { cli, comp } = await getClientAndConfig(ctx)
    const f = filial || comp?.protheus_filial || ctx?.branch || '0101'
    return cli.get(`/PlanoContasRest${buildQuery({ cFil: f })}`, getHeaders(ctx, comp))
  },
  
  // Executador de Query Genérico e Core
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
    return cli.get(`${path}${buildQuery(params)}`, getHeaders(ctx, comp))
  }
}

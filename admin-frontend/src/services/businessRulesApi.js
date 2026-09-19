import api from '../api/axios';

const basePath = '/api/admin/business-rules';

function tenantQuery(tenantId) {
  return { params: { tenant_id: tenantId } };
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function getBusinessRulesMetadata() {
  const { data } = await api.get(`${basePath}/metadata`);
  return data;
}

export async function getBusinessRulesTenants() {
  const { data } = await api.get('/api/tenants');
  return data?.tenants || data || [];
}

export async function getBusinessRulesData(tenantId) {
  const query = tenantQuery(tenantId);
  const [overview, tesSaida, tesEntrada, cfop, financialNatures, synonyms, config, audit] = await Promise.all([
    api.get(`${basePath}/overview`, query),
    api.get(`${basePath}/tes`, { ...query, params: { ...query.params, direction: 'saida' } }),
    api.get(`${basePath}/tes`, { ...query, params: { ...query.params, direction: 'entrada' } }),
    api.get(`${basePath}/cfop`, query),
    api.get(`${basePath}/financial-natures`, query),
    api.get(`${basePath}/synonyms`, query),
    api.get(`${basePath}/config`, query),
    api.get(`${basePath}/audit`, query),
  ]);

  return {
    overview: overview.data,
    tesSaida: normalizeList(tesSaida.data),
    tesEntrada: normalizeList(tesEntrada.data),
    cfop: normalizeList(cfop.data),
    financialNatures: normalizeList(financialNatures.data),
    synonyms: normalizeList(synonyms.data),
    config: config.data?.config || config.data,
    audit: normalizeList(audit.data),
  };
}

export async function createTesRule(tenantId, payload) {
  const { data } = await api.post(`${basePath}/tes`, { tenant_id: tenantId, ...payload });
  return data;
}

export async function deleteTesRule(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/tes/${ruleId}`, tenantQuery(tenantId));
  return data;
}

export async function createCfopRule(tenantId, payload) {
  const { data } = await api.post(`${basePath}/cfop`, { tenant_id: tenantId, ...payload });
  return data;
}

export async function deleteCfopRule(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/cfop/${ruleId}`, tenantQuery(tenantId));
  return data;
}

export async function createFinancialNature(tenantId, payload) {
  const { data } = await api.post(`${basePath}/financial-natures`, { tenant_id: tenantId, ...payload });
  return data;
}

export async function deleteFinancialNature(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/financial-natures/${ruleId}`, tenantQuery(tenantId));
  return data;
}

export async function createSynonym(tenantId, payload) {
  const { data } = await api.post(`${basePath}/synonyms`, { tenant_id: tenantId, ...payload });
  return data;
}

export async function deleteSynonym(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/synonyms/${ruleId}`, tenantQuery(tenantId));
  return data;
}

export async function updateBusinessRulesConfig(tenantId, payload) {
  const { data } = await api.put(`${basePath}/config`, { tenant_id: tenantId, ...payload });
  return data;
}

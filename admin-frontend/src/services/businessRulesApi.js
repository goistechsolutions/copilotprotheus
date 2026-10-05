import api from '../api/axios';

const basePath = '/api/admin/governance/business-rules';

export async function getBusinessRulesTenants() {
  const { data } = await api.get('/api/tenants');
  return data?.tenants || data || (data?.items ? data.items : []);
}

export async function getBusinessRulesData(tenantId) {
  // Fetch ALL rules for this tenant
  const { data } = await api.get(basePath, { params: { tenant_id: tenantId } });
  const rules = Array.isArray(data) ? data : (data?.items || []);
  
  const tesSaida = rules.filter(r => r.rule_type === 'tes_saida').map(r => ({ id: r.id, ...r.rule_json }));
  const tesEntrada = rules.filter(r => r.rule_type === 'tes_entrada').map(r => ({ id: r.id, ...r.rule_json }));
  const cfop = rules.filter(r => r.rule_type === 'cfop').map(r => ({ id: r.id, ...r.rule_json }));
  const financialNatures = rules.filter(r => r.rule_type === 'natureza_financeira').map(r => ({ id: r.id, ...r.rule_json }));
  const configRule = rules.find(r => r.rule_type === 'config');
  
  return {
    overview: {
        tes_count: tesSaida.length + tesEntrada.length,
        cfop_count: cfop.length,
        nature_count: financialNatures.length,
        synonym_count: 0
    },
    tesSaida,
    tesEntrada,
    cfop,
    financialNatures,
    synonyms: [], // Migrated to SemanticDictionaryPage
    config: configRule ? configRule.rule_json : {},
    audit: [],
  };
}

export async function createTesRule(tenantId, payload) {
  const rule_type = payload.direction === 'entrada' ? 'tes_entrada' : 'tes_saida';
  const { data } = await api.post(basePath, {
    tenant_id: tenantId,
    intent_code: 'GLOBAL',
    rule_type: rule_type,
    rule_json: payload
  });
  return data;
}

export async function deleteTesRule(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/${ruleId}`, { params: { tenant_id: tenantId } });
  return data;
}

export async function createCfopRule(tenantId, payload) {
  const { data } = await api.post(basePath, {
    tenant_id: tenantId,
    intent_code: 'GLOBAL',
    rule_type: 'cfop',
    rule_json: payload
  });
  return data;
}

export async function deleteCfopRule(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/${ruleId}`, { params: { tenant_id: tenantId } });
  return data;
}

export async function createFinancialNature(tenantId, payload) {
  const { data } = await api.post(basePath, {
    tenant_id: tenantId,
    intent_code: 'GLOBAL',
    rule_type: 'natureza_financeira',
    rule_json: payload
  });
  return data;
}

export async function deleteFinancialNature(tenantId, ruleId) {
  const { data } = await api.delete(`${basePath}/${ruleId}`, { params: { tenant_id: tenantId } });
  return data;
}

export async function createSynonym(tenantId, payload) {
  // Deprecated here, handled by SemanticDictionaryPage
  return null;
}

export async function deleteSynonym(tenantId, ruleId) {
  // Deprecated here
  return null;
}

export async function updateBusinessRulesConfig(tenantId, payload) {
  // First we need to delete the old config rule if exists, then create new
  const { data: currentRules } = await api.get(basePath, { params: { tenant_id: tenantId } });
  const existingConfig = (Array.isArray(currentRules) ? currentRules : (currentRules?.items || [])).find(r => r.rule_type === 'config');
  
  if (existingConfig) {
      await api.delete(`${basePath}/${existingConfig.id}`, { params: { tenant_id: tenantId } });
  }
  
  const { data } = await api.post(basePath, {
    tenant_id: tenantId,
    intent_code: 'GLOBAL',
    rule_type: 'config',
    rule_json: payload
  });
  return data;
}

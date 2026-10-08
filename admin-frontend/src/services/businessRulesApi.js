import api from '../api/axios';

const basePath = '/api/admin/governance/business-rules';

export async function getBusinessRulesMetadata() {
  return {
      version: 1,
      classifications: {
          tes: [
              {value: "VENDA", label: "Venda", directions: ["saida"]},
              {value: "BONIFICACAO", label: "Bonificação", directions: ["saida", "entrada"]},
              {value: "DEVOLUCAO", label: "Devolução", directions: ["saida", "entrada"]},
              {value: "REMESSA", label: "Remessa", directions: ["saida", "entrada"]},
              {value: "TRANSFERENCIA", label: "Transferência", directions: ["saida", "entrada"]},
              {value: "EXPORTACAO", label: "Exportação", directions: ["saida"]},
              {value: "COMPRA", label: "Compra", directions: ["entrada"]},
              {value: "CONSIGNACAO", label: "Consignação", directions: ["saida", "entrada"]},
              {value: "MOSTRUARIO", label: "Mostruário", directions: ["saida", "entrada"]},
              {value: "OUTROS", label: "Outros", directions: ["saida", "entrada"]},
          ],
          cfop: [
              {value: "VENDA", label: "Venda"},
              {value: "DEVOLUCAO", label: "Devolução"},
              {value: "REMESSA", label: "Remessa"},
              {value: "TRANSFERENCIA", label: "Transferência"},
              {value: "COMPRA", label: "Compra"},
              {value: "OUTROS", label: "Outros"},
          ],
      },
      financialGroups: [
          {value: "RECEITA", label: "Receita"},
          {value: "CUSTO", label: "Custo"},
          {value: "DESPESA", label: "Despesa"},
          {value: "INVESTIMENTO", label: "Investimento"},
          {value: "IMPOSTO", label: "Imposto"},
          {value: "OPERACAO_FINANCEIRA", label: "Operação Financeira"},
      ],
      cashFlowTables: ["SE1", "SE2", "SE5"],
      defaults: {
          billing_included_classifications: ["VENDA", "EXPORTACAO"],
          billing_excluded_classifications: ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"],
          receivables_overdue_days: 30,
          receivables_include_renegotiated: false,
          receivables_include_provisional: true,
          stock_idle_days: 90,
          stock_critical_days: 7,
      }
  };
}

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
  
  const totalRules = tesSaida.length + tesEntrada.length + cfop.length + financialNatures.length;
  const dates = rules.map(r => r.created_at).filter(Boolean);
  const lastUpdate = dates.length > 0 ? dates.sort().reverse()[0] : null;

  return {
    overview: {
        total_active_rules: totalRules,
        last_update: lastUpdate,
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

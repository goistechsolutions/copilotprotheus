import api from '../api/axios';

const INVALID_ENVIRONMENTS = new Set(['default', 'none', 'null']);

function normalizeEnvironmentCode(environmentCode) {
  const normalized = String(environmentCode || '').trim();
  if (!normalized || INVALID_ENVIRONMENTS.has(normalized.toLowerCase())) {
    throw new Error('Ambiente real não informado.');
  }
  return normalized;
}

function normalizeModule(item = {}) {
  return {
    ...item,
    module_code: String(item.module_code ?? item.mod_code ?? '').trim(),
    module_sigla: String(item.module_sigla ?? item.mod_sigla ?? '').trim().toUpperCase(),
    module_name: String(item.module_name ?? item.mod_name ?? item.module_sigla ?? item.mod_sigla ?? '').trim(),
  };
}

export async function getAvailableModules(companyId, environmentCode) {
  const environment_code = normalizeEnvironmentCode(environmentCode);
  const { data } = await api.get(`/api/companies/${companyId}/modules/available`, {
    params: { environment_code },
  });
  return {
    ...data,
    items: Array.isArray(data?.items) ? data.items.map(normalizeModule) : [],
  };
}

export async function getCompanyModules(companyId) {
  const { data } = await api.get(`/api/companies/${companyId}/modules`);
  return {
    ...data,
    items: Array.isArray(data?.items) ? data.items.map(normalizeModule) : [],
  };
}

export async function saveCompanyModules(companyId, modules) {
  const payload = {
    modules: modules.map((item) => ({
      module_code: item.module_code,
      enabled: !!item.enabled,
    })),
  };

  const { data } = await api.post(`/api/companies/${companyId}/modules`, payload);
  return data;
}

export async function syncCompanyModules(companyId, environmentCode, forceFullReload = false) {
  const environment_code = normalizeEnvironmentCode(environmentCode);

  const { data } = await api.post(`/api/companies/${companyId}/modules/sync`, {
    environment_code,
    force_full_reload: forceFullReload,
  });
  return data;
}

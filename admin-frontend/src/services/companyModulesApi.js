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
  const moduleId = Number(item.moduleId);
  const moduleSigla = String(item.moduleSigla || '').trim().toUpperCase();
  const description = String(item.description || '').trim();

  if (!Number.isInteger(moduleId) || moduleId <= 0 || !moduleSigla || !description) {
    const error = new Error('Resposta inválida do catálogo de módulos.');
    error.code = 'INVALID_MODULE_CATALOG_RESPONSE';
    throw error;
  }

  return {
    ...item,
    moduleId,
    moduleSigla,
    description,
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

export async function saveCompanyModules(companyId, moduleIds) {
  const payload = {
    moduleIds: moduleIds.map((id) => Number(id)),
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

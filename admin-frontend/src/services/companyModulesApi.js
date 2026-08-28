import api from '../api/axios';

export async function getAvailableModules(companyId) {
  const { data } = await api.get(`/api/companies/${companyId}/modules/available`);
  return data;
}

export async function getCompanyModules(companyId) {
  const { data } = await api.get(`/api/companies/${companyId}/modules`);
  return data;
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
  const environment_code = String(environmentCode || '').trim();
  if (!environment_code || ['default', 'none', 'null'].includes(environment_code.toLowerCase())) {
    throw new Error('Ambiente real não informado para sincronização.');
  }

  const { data } = await api.post(`/api/companies/${companyId}/modules/sync`, {
    environment_code,
    force_full_reload: forceFullReload,
  });
  return data;
}

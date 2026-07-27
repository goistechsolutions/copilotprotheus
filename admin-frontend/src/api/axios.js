import axios from 'axios';

// Lê as credenciais do .env do Vite
const adminUser = import.meta.env.VITE_ADMIN_USER || 'admin';
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

function getSanitizedBaseUrl() {
  let url = import.meta.env.VITE_API_BASE_URL ?? '';
  // Se a página estiver rodando em HTTPS, força HTTPS na BASE_URL para evitar Mixed Content
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

const api = axios.create({
  baseURL: getSanitizedBaseUrl(),
  auth: {
    username: adminUser,
    password: adminPassword
  }
});

// Interceptor para garantir HTTPS e sanitização em todas as requisições em tempo de execução
api.interceptors.request.use((config) => {
  const currentBase = config.baseURL || getSanitizedBaseUrl();
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && currentBase.startsWith('http://')) {
    config.baseURL = currentBase.replace('http://', 'https://');
  } else {
    config.baseURL = currentBase;
  }
  return config;
});

export { api, api as axios };
export default api;

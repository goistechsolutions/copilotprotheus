/**
 * FONTE ÚNICA DE VERDADE para todas as chamadas HTTP do admin-frontend.
 * - baseURL vazia → URL relativa → Nginx interno faz proxy /api/ → backend:8000
 * - withCredentials: true para envio automático de cookies JWT (admin_token)
 * - HTTPS forçado quando a página roda em HTTPS (evita Mixed Content)
 */
import axios from 'axios';

function getSanitizedBaseUrl() {
  let url = import.meta.env.VITE_API_BASE_URL ?? '';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

const api = axios.create({
  baseURL: getSanitizedBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Garante HTTPS em runtime nas requisições
api.interceptors.request.use((config) => {
  const base = config.baseURL || getSanitizedBaseUrl();
  config.baseURL =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    base.startsWith('http://')
      ? base.replace('http://', 'https://')
      : base;
  return config;
});

export { api, api as axios };
export default api;

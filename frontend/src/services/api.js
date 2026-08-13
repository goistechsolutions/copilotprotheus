export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : 'https://copilot-api.elitecorp.tec.br/api');

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  
  if (!res.ok) {
    let errMessage = `Erro na requisição (Status ${res.status})`;
    try {
      const data = await res.clone().json();
      errMessage = data.detail || data.error || errMessage;
    } catch (e) {
      errMessage = await res.text();
    }
    throw new Error(errMessage);
  }
  
  return res.json();
}

export const api = {
  validateContext: (payload) => request('/agent/validate-context', { method: 'POST', body: JSON.stringify(payload) }),
  askAgent: (payload) => request('/agent/ask/v2', { method: 'POST', body: JSON.stringify(payload) }),
  validateQuery: (payload) => request('/agent/validate-query', { method: 'POST', body: JSON.stringify(payload) })
};

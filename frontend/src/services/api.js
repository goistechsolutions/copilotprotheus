const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  
  if (!res.ok) {
    let errMessage = 'Erro na requisição';
    try {
      const data = await res.json();
      errMessage = data.detail || data.error || errMessage;
    } catch (e) {
      errMessage = await res.text();
    }
    throw new Error(errMessage);
  }
  
  return res.json();
}

export const api = {
  askAgent: (payload) => request('/agent/ask', { method: 'POST', body: JSON.stringify(payload) }),
  validateQuery: (payload) => request('/agent/validate-query', { method: 'POST', body: JSON.stringify(payload) })
};

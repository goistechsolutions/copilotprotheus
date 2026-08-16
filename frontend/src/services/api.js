const API_BASE = import.meta.env.VITE_API_BASE || 'https://copilot-api.elitecorp.tec.br/api';

async function fetchWithRetry(url, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function askAgent(payload) {
  return fetchWithRetry(`${API_BASE}/agent/ask/v2`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAgentFile(formData) {
  const response = await fetch(`${API_BASE}/agent/ask/v2/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getAgentTaskStatus(taskId) {
  return fetchWithRetry(`${API_BASE}/agent/ask/v2/status/${taskId}`, {
    method: 'GET',
  });
}

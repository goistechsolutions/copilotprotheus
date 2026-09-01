export const API_BASE = '/api';

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2): Promise<any> {
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

export async function askAgent(payload: any) {
  return fetchWithRetry(`${API_BASE}/agent/ask/v2`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAgentTaskStatus(taskId: string) {
  return fetchWithRetry(`${API_BASE}/agent/ask/v2/status/${taskId}`, {
    method: 'GET',
  });
}

export async function exportStructuredReport(payload: any) {
  return fetchWithRetry(`${API_BASE}/report/export-structured`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

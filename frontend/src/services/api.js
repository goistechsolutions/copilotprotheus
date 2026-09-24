import {
  isTaskTerminal,
  normalizeTaskPayload,
} from './taskStatus';

export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('elitecorp.tec.br') || host.includes('pages.dev')) {
      return 'https://copilot-api.elitecorp.tec.br/api';
    }
  }
  return '/api';
}

export const API_BASE = getApiBaseUrl();

export class ApiRequestError extends Error {
  constructor(message, payload = {}, status = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status || payload.http_status || payload.status_code || null;
    this.payload = payload;
    this.correlation_id = payload.correlation_id || null;
  }
}

async function readErrorPayload(response) {
  const raw = await response.text();
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.detail && typeof parsed.detail === 'object'
      ? { ...parsed, ...parsed.detail }
      : parsed;
  } catch {
    return { message: raw || `HTTP ${response.status}` };
  }
}

async function fetchWithRetry(url, options = {}, retries = 2) {
  let lastError;
  const token = localStorage.getItem('copilot_access_token');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      });
      if (!response.ok) {
        const payload = await readErrorPayload(response);
        const message = payload.message || payload.error || payload.detail || `HTTP ${response.status}`;
        throw new ApiRequestError(String(message), payload, response.status);
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
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/agent/ask/v2`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAgentFile(formData) {
  const base = getApiBaseUrl();
  const token = localStorage.getItem('copilot_access_token');
  const response = await fetch(`${base}/agent/ask/v2/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiRequestError(
      String(payload.message || payload.error || payload.detail || `HTTP ${response.status}`),
      payload,
      response.status,
    );
  }
  return response.json();
}

export async function getAgentTaskStatus(taskId) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/agent/ask/v2/status/${taskId}`, {
    method: 'GET',
  });
}

export async function exportStructuredReport(formatOrPayload, maybePayload = {}) {
  const base = getApiBaseUrl();
  const payload = typeof formatOrPayload === 'string'
    ? { ...maybePayload, format: formatOrPayload }
    : (formatOrPayload || {});
  return fetchWithRetry(`${base}/report/export-structured`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function downloadStructuredReport(downloadUrl) {
  if (!downloadUrl) throw new Error('URL de download do relatório não informada.');
  const base = getApiBaseUrl();
  const token = localStorage.getItem('copilot_access_token');
  const url = downloadUrl.startsWith('http')
    ? downloadUrl
    : (downloadUrl.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${downloadUrl}`
      : `${base}/${String(downloadUrl).replace(/^\//, '')}`);
  const response = await fetch(url, { 
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }
  });
  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiRequestError(String(payload.message || payload.error || `HTTP ${response.status}`), payload, response.status);
  }
  return response.blob();
}


export async function waitForAgentTask(
  taskId,
  {
    timeoutMs = 600000,
    intervalMs = 800,
    onUpdate,
    signal,
  } = {},
) {
  if (!taskId) {
    throw new Error('Identificador da tarefa não informado.');
  }

  const deadline = Date.now() + timeoutMs;
  let pollAttempt = 0;
  let lastPayload = normalizeTaskPayload({
    task_id: taskId,
    status: 'queued',
  });

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const error = new Error('Consulta cancelada pelo usuário.');
      error.code = 'TASK_CANCELLED';
      error.lastPayload = lastPayload;
      throw error;
    }

    const response = await getAgentTaskStatus(taskId);
    lastPayload = normalizeTaskPayload(response);
    onUpdate?.(lastPayload);

    if (isTaskTerminal(lastPayload.status)) {
      return lastPayload;
    }

    const pollDelay = Math.min(intervalMs * (2 ** Math.min(pollAttempt, 3)), 3000);
    pollAttempt += 1;
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(resolve, pollDelay);

      if (!signal) return;

      const abortHandler = () => {
        window.clearTimeout(timer);
        const error = new Error('Consulta cancelada pelo usuário.');
        error.code = 'TASK_CANCELLED';
        error.lastPayload = lastPayload;
        reject(error);
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    });
  }

  const error = new Error(
    'Tempo limite excedido aguardando o processamento do agente.',
  );
  error.code = 'TASK_TIMEOUT';
  error.lastPayload = lastPayload;
  throw error;
}

export async function apiGetAuthMe() {
  const url = `${getApiBaseUrl()}/auth/me`;
  const token = localStorage.getItem('copilot_access_token');
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Não autenticado');
  }
  return response.json();
}

export async function apiLogin(tenant_id, username, password) {
  const url = `${getApiBaseUrl()}/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ tenant_id, username, password })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Falha no login');
  }
  const data = await response.json();
  if (data.access_token) {
    localStorage.setItem('copilot_access_token', data.access_token);
  }
  return data;
}

// ==========================================
// Copilot Chat 2.0 - Conversas e Persistência
// ==========================================

export async function getConversations(params = {}) {
  const base = getApiBaseUrl();
  const query = new URLSearchParams();
  if (params.tenant_id) query.append('tenant_id', params.tenant_id);
  if (params.user_id) query.append('user_id', params.user_id);
  if (params.q) query.append('q', params.q);
  if (params.is_favorite !== undefined) query.append('is_favorite', params.is_favorite);
  if (params.limit) query.append('limit', params.limit);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchWithRetry(`${base}/conversations${qs}`, { method: 'GET' });
}

export async function createConversation(payload = {}) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getConversation(conversationId) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/${conversationId}`, { method: 'GET' });
}

export async function updateConversation(conversationId, payload = {}) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteConversation(conversationId) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/${conversationId}`, { method: 'DELETE' });
}

export async function addConversationMessage(conversationId, payload = {}) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addConversationDashboard(conversationId, payload = {}) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/${conversationId}/dashboards`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getFavorites(tenant_id = null) {
  const base = getApiBaseUrl();
  const qs = tenant_id ? `?tenant_id=${encodeURIComponent(tenant_id)}` : '';
  return fetchWithRetry(`${base}/conversations/favorites${qs}`, { method: 'GET' });
}

export async function toggleConversationFavorite(entityType, entityId, isFavorite) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/conversations/favorites/toggle`, {
    method: 'POST',
    body: JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
      is_favorite: isFavorite,
    }),
  });
}

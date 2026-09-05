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
  const response = await fetch(`${base}/agent/ask/v2/upload`, {
    method: 'POST',
    credentials: 'include',
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

export async function exportStructuredReport(payload) {
  const base = getApiBaseUrl();
  return fetchWithRetry(`${base}/report/export-structured`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


export async function waitForAgentTask(
  taskId,
  {
    timeoutMs = 120000,
    intervalMs = 800,
    onUpdate,
    signal,
  } = {},
) {
  if (!taskId) {
    throw new Error('Identificador da tarefa não informado.');
  }

  const deadline = Date.now() + timeoutMs;
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

    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs);

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
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    },
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Não autenticado');
  }
  return response.json();
}

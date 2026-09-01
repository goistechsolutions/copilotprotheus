const SOURCE_LABELS = {
  gemini: 'Gemini',
  protheus_queryrest: 'Protheus QueryRest',
  protheus: 'Protheus',
  api: 'API do Copilot',
  authorization: 'Autorização',
  database: 'Banco do Copilot',
  internal: 'Backend do Copilot',
};

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function normalizeAgentError(input, fallback = {}) {
  const parsed = parseMaybeJson(input) || {};
  const nested = parseMaybeJson(parsed.detail) || {};
  const data = { ...fallback, ...parsed, ...nested };
  const rawSource = String(data.error_source || data.source || '').trim().toLowerCase();
  const status = Number(data.http_status || data.status_code || data.status || fallback.http_status || 0) || null;
  const rawMessage = data.message || data.execution_error || data.error || data.summary || data.detail;
  const message = String(rawMessage || 'O backend retornou um erro sem mensagem detalhada.').slice(0, 500);

  let source = rawSource;
  if (!source) {
    const normalized = message.toLowerCase();
    if (normalized.includes('gemini') || normalized.includes('generativelanguage')) source = 'gemini';
    else if (normalized.includes('queryrest') || normalized.includes('appserver') || normalized.includes('protheus')) source = 'protheus_queryrest';
    else if (status === 401 || status === 403) source = 'authorization';
    else source = 'api';
  }

  return {
    source,
    sourceLabel: SOURCE_LABELS[source] || source,
    status,
    code: data.error_code || data.code || null,
    message,
    retryable: Boolean(data.retryable),
    correlationId: data.correlation_id || data.correlationId || fallback.correlation_id || null,
  };
}

export function formatAgentError(error) {
  return normalizeAgentError(error).message;
}

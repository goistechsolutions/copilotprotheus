// frontend/src/services/taskStatus.js

export const TASK_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const STATUS_ALIASES = Object.freeze({
  queued: TASK_STATUS.QUEUED,
  pending: TASK_STATUS.QUEUED,
  created: TASK_STATUS.QUEUED,
  waiting: TASK_STATUS.QUEUED,
  accepted: TASK_STATUS.QUEUED,

  processing: TASK_STATUS.PROCESSING,
  running: TASK_STATUS.PROCESSING,
  started: TASK_STATUS.PROCESSING,
  in_progress: TASK_STATUS.PROCESSING,
  inprogress: TASK_STATUS.PROCESSING,

  success: TASK_STATUS.SUCCESS,
  succeeded: TASK_STATUS.SUCCESS,
  completed: TASK_STATUS.SUCCESS,
  complete: TASK_STATUS.SUCCESS,
  done: TASK_STATUS.SUCCESS,
  finished: TASK_STATUS.SUCCESS,

  failed: TASK_STATUS.FAILED,
  failure: TASK_STATUS.FAILED,
  error: TASK_STATUS.FAILED,
  execution_failed: TASK_STATUS.FAILED,
  execution_error: TASK_STATUS.FAILED,
  forbidden: TASK_STATUS.FAILED,
  validation_failed: TASK_STATUS.FAILED,
  unauthorized: TASK_STATUS.FAILED,

  cancelled: TASK_STATUS.CANCELLED,
  canceled: TASK_STATUS.CANCELLED,
  aborted: TASK_STATUS.CANCELLED,
});

const TERMINAL_STATUSES = new Set([
  TASK_STATUS.SUCCESS,
  TASK_STATUS.FAILED,
  TASK_STATUS.CANCELLED,
]);

export function normalizeTaskStatus(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  // Estado desconhecido nunca deve ser tratado como sucesso.
  return STATUS_ALIASES[normalized] || TASK_STATUS.PROCESSING;
}

export function isTaskTerminal(value) {
  return TERMINAL_STATUSES.has(normalizeTaskStatus(value));
}

export function isTaskSuccessful(value) {
  return normalizeTaskStatus(value) === TASK_STATUS.SUCCESS;
}

export function isTaskFailed(value) {
  return normalizeTaskStatus(value) === TASK_STATUS.FAILED;
}

export function isTaskCancelled(value) {
  return normalizeTaskStatus(value) === TASK_STATUS.CANCELLED;
}

function normalizeTaskId(payload) {
  const value = payload?.task_id ?? payload?.taskId ?? payload?.id;
  return value === undefined || value === null || value === ''
    ? null
    : String(value);
}

function normalizeTaskMessage(payload) {
  const candidates = [
    payload?.message,
    payload?.summary,
    payload?.response_text,
    payload?.answer,
  ];

  const message = candidates.find(
    value => typeof value === 'string' && value.trim().length > 0,
  );

  return message ? message.trim() : null;
}

function normalizeTaskError(payload) {
  const detail = payload?.detail && typeof payload.detail === 'object'
    ? payload.detail
    : null;

  const candidates = [
    payload?.error,
    payload?.execution_error,
    payload?.error_message,
    detail?.message,
    typeof payload?.detail === 'string' ? payload.detail : null,
  ];

  const error = candidates.find(
    value => typeof value === 'string' && value.trim().length > 0,
  );

  return error ? error.trim() : null;
}

function normalizeTaskResult(payload) {
  if (payload?.result !== undefined) return payload.result;
  if (payload?.structured !== undefined) return payload.structured;
  if (payload?.data !== undefined) return payload.data;
  if (payload?.items !== undefined) return payload.items;
  return null;
}

export function normalizeTaskPayload(payload = {}) {
  const safePayload = payload && typeof payload === 'object'
    ? payload
    : {};

  return {
    ...safePayload,
    taskId: normalizeTaskId(safePayload),
    status: normalizeTaskStatus(safePayload.status),
    message: normalizeTaskMessage(safePayload),
    error: normalizeTaskError(safePayload),
    correlationId: safePayload.correlation_id ?? safePayload.correlationId ?? null,
    retryable: Boolean(safePayload.retryable),
    result: normalizeTaskResult(safePayload),
  };
}

export function getTaskStatusLabel(value) {
  switch (normalizeTaskStatus(value)) {
    case TASK_STATUS.QUEUED:
      return 'Tarefa aguardando processamento';
    case TASK_STATUS.PROCESSING:
      return 'Processando consulta no Protheus';
    case TASK_STATUS.SUCCESS:
      return 'Consulta concluída';
    case TASK_STATUS.FAILED:
      return 'Consulta não concluída';
    case TASK_STATUS.CANCELLED:
      return 'Consulta cancelada';
    default:
      return 'Processando consulta no Protheus';
  }
}

const ERROR_STATUSES = new Set([
  'failed',
  'error',
  'execution_failed',
  'validation_failed',
  'forbidden',
  'unauthorized',
]);

const SUCCESS_STATUSES = new Set(['success', 'completed']);

export function normalizeAgentResult(raw) {
  const root = raw || {};
  const nested = root.result || {};
  const status = String(root.status || nested.status || '').toLowerCase();
  const errorCode = root.error_code || nested.error_code || null;
  const hasError =
    ERROR_STATUSES.has(status) ||
    Boolean(root.error) ||
    Boolean(nested.error) ||
    Boolean(errorCode);

  if (hasError || !SUCCESS_STATUSES.has(status)) {
    return {
      status: 'error',
      errorCode,
      message: root.message || root.error || nested.message || 'Consulta não concluída.',
      correlationId: root.correlation_id || nested.correlation_id || null,
      result: null,
    };
  }

  const payload = nested.structured || nested;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const columns = Array.isArray(payload.columns) ? payload.columns : [];

  return {
    status: 'success',
    errorCode: null,
    message: root.message || root.summary || payload.summary || '',
    correlationId: root.correlation_id || payload.correlation_id || null,
    result: {
      rows,
      columns,
      metadata: payload.metadata || { row_count: rows.length },
      kpis: Array.isArray(payload.kpis) ? payload.kpis : [],
      series: Array.isArray(payload.series) ? payload.series : [],
      summary: payload.summary || root.summary || '',
    },
  };
}

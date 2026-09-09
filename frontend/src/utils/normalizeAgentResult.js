const ERROR_STATUSES = new Set([
  'failed', 'error', 'execution_failed',
  'validation_failed', 'forbidden', 'unauthorized',
]);

export function normalizeAgentResult(raw) {
  const root = raw || {};
  const status = String(root.status || '').toLowerCase();
  const errorCode = root.error_code || null;

  if (ERROR_STATUSES.has(status) || root.error || errorCode) {
    return {
      status: 'error',
      message: root.message || root.error || root.summary || 'Consulta não concluída.',
      errorCode,
      correlationId: root.correlation_id || null,
      result: null,
      hasData: false,
      canExport: false,
    };
  }

  if (!['success', 'completed'].includes(status) || !root.result) {
    return {
      status: 'error',
      message: 'Resposta do agente em formato inválido.',
      errorCode: 'INVALID_AGENT_RESULT_CONTRACT',
      correlationId: root.correlation_id || null,
      result: null,
      hasData: false,
      canExport: false,
    };
  }

  const payload = root.result;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const dimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const measures = Array.isArray(payload.measures) ? payload.measures : [];
  const kpis = Array.isArray(payload.kpis) ? payload.kpis : [];
  const series = Array.isArray(payload.series) ? payload.series : [];

  const validKpis = kpis.filter((kpi) =>
    kpi &&
    typeof kpi.label === 'string' &&
    Number.isFinite(Number(kpi.value)) &&
    ['currency', 'number', 'percent', 'date'].includes(kpi.format) &&
    typeof kpi.source_column === 'string' &&
    typeof kpi.aggregation === 'string'
  );

  return {
    status: 'success',
    message: root.message || root.summary || '',
    errorCode: null,
    correlationId: root.correlation_id || null,
    result: {
      columns,
      rows,
      metadata: payload.metadata || { row_count: rows.length },
      dimensions,
      measures,
      kpis: validKpis,
      series,
    },
    hasData: rows.length > 0,
    hasTypedKpis: validKpis.length > 0,
    hasTimeDimension: dimensions.some(d => d.kind === 'time'),
    hasSellerDimension: dimensions.some(d => d.key.includes('VENDEDOR') || d.key.includes('VEND')),
    hasProductDimension: dimensions.some(d => d.key.includes('PRODUTO') || d.key.includes('ITEM') || d.key.includes('GRUPO')),
    canExport: rows.length > 0 && columns.length > 0,
  };
}

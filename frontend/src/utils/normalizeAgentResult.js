/**
 * Normaliza o contrato de resultado do Agent antes de qualquer renderização.
 * Erros e contratos inválidos nunca expõem payload estruturado residual.
 */

const ERROR_STATUSES = new Set([
  'failed',
  'error',
  'execution_failed',
  'validation_failed',
  'forbidden',
  'unauthorized',
]);

const SUCCESS_STATUSES = new Set(['success', 'completed']);
const KPI_FORMATS = new Set(['currency', 'number', 'percent', 'date']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isTypedKpi(kpi, measures) {
  if (!kpi || typeof kpi !== 'object') return false;

  const value = Number(kpi.value);
  if (!Number.isFinite(value)) return false;
  if (typeof kpi.label !== 'string' || !kpi.label.trim()) return false;
  if (!KPI_FORMATS.has(kpi.format)) return false;
  if (typeof kpi.source_column !== 'string' || !kpi.source_column.trim()) return false;
  if (typeof kpi.aggregation !== 'string' || !kpi.aggregation.trim()) return false;

  return measures.some((measure) => measure?.key === kpi.source_column);
}

function hasDimension(dimensions, matcher) {
  return dimensions.some((dimension) => matcher(String(dimension?.key || '').toUpperCase(), dimension));
}

function emptyResult(status, message, errorCode, correlationId) {
  return {
    status,
    message: message || 'Consulta não concluída.',
    errorCode: errorCode || null,
    correlationId: correlationId || null,
    result: null,
    hasData: false,
    hasTypedKpis: false,
    hasTimeDimension: false,
    hasSellerDimension: false,
    hasProductDimension: false,
    canExport: false,
    canRenderDashboard: false,
  };
}

export function normalizeAgentResult(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const payload = root.result && typeof root.result === 'object' ? root.result : null;
  const status = normalizeStatus(root.status || payload?.status);
  const errorCode = root.error_code || payload?.error_code || null;
  const message = root.message || root.error || payload?.message || '';
  const correlationId = root.correlation_id || payload?.correlation_id || null;

  const hasExplicitError = Boolean(root.error || payload?.error || errorCode);
  if (ERROR_STATUSES.has(status) || hasExplicitError) {
    return emptyResult('error', message, errorCode, correlationId);
  }

  if (!SUCCESS_STATUSES.has(status) || !payload) {
    return emptyResult(
      'error',
      message || 'Resposta do agente em formato inválido.',
      errorCode || 'INVALID_AGENT_RESULT_CONTRACT',
      correlationId,
    );
  }

  const rows = asArray(payload.rows);
  const columns = asArray(payload.columns);
  const dimensions = asArray(payload.dimensions);
  const measures = asArray(payload.measures);
  const series = asArray(payload.series);
  const kpis = asArray(payload.kpis).filter((kpi) => isTypedKpi(kpi, measures));

  const hasData = rows.length > 0;
  const hasTimeDimension = hasDimension(
    dimensions,
    (key, dimension) => dimension?.kind === 'time' || /(^|_)(DATE|DATA|MES|PERIODO|ANO)(_|$)/.test(key),
  );
  const hasSellerDimension = hasDimension(
    dimensions,
    (key) => /VENDEDOR|SELLER/.test(key),
  );
  const hasProductDimension = hasDimension(
    dimensions,
    (key) => /PRODUTO|PRODUCT|GRUPO_PROD|GRUPO_PRODUCT/.test(key),
  );
  const hasTypedSeries = series.some((serie) =>
    serie &&
    typeof serie === 'object' &&
    typeof serie.dimension === 'string' &&
    typeof serie.measure === 'string' &&
    asArray(serie.points).length > 0,
  );

  return {
    status: 'success',
    message: message || payload.summary || '',
    errorCode: null,
    correlationId,
    result: {
      columns,
      rows,
      metadata: payload.metadata && typeof payload.metadata === 'object'
        ? payload.metadata
        : { row_count: rows.length },
      dimensions,
      measures,
      kpis,
      series,
      summary: payload.summary || root.summary || '',
    },
    hasData,
    hasTypedKpis: kpis.length > 0,
    hasTimeDimension,
    hasSellerDimension,
    hasProductDimension,
    canExport: hasData && columns.length > 0,
    canRenderDashboard: hasData && (kpis.length > 0 || hasTypedSeries),
  };
}

export const AGENT_RESULT_ERROR_STATUSES = ERROR_STATUSES;

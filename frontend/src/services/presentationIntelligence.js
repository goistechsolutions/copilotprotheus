/**
 * Presentation Intelligence Engine
 *
 * Camada de humanização e narração executiva.
 * Funções puras, sem efeitos colaterais, sem dependências do dashboard engine.
 */

// ─── Dicionário de Meses ──────────────────────────────────────────────────────
const MONTH_NAMES = {
  '1': 'Janeiro',  '01': 'Janeiro',
  '2': 'Fevereiro','02': 'Fevereiro',
  '3': 'Março',    '03': 'Março',
  '4': 'Abril',    '04': 'Abril',
  '5': 'Maio',     '05': 'Maio',
  '6': 'Junho',    '06': 'Junho',
  '7': 'Julho',    '07': 'Julho',
  '8': 'Agosto',   '08': 'Agosto',
  '9': 'Setembro', '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

// ─── Padrões de Colunas Temporais ─────────────────────────────────────────────
const TIME_DIMENSION_PATTERNS = [
  { pattern: /\bMES\b|^MES$|_MES$|^MES_|_MES_/i, granularity: 'month' },
  { pattern: /MONTH/i, granularity: 'month' },
  { pattern: /\bANO\b|^ANO$|_ANO$|^ANO_|_ANO_/i, granularity: 'year' },
  { pattern: /\bYEAR\b|^YEAR$/i, granularity: 'year' },
  { pattern: /MES_ANO|ANO_MES|PERIODO|COMPETENCIA|REFERENCIA/i, granularity: 'month_year' },
  { pattern: /SEMANA|WEEK/i, granularity: 'week' },
  { pattern: /SEMESTRE/i, granularity: 'semester' },
  { pattern: /TRIMESTRE|QUARTER/i, granularity: 'quarter' },
];

// ─── Prefixos Protheus a remover ──────────────────────────────────────────────
const PROTHEUS_PREFIXES = [
  /^(F2|D2|D1|SF2|SD2|SD1|SF1|SA1|SA2|SA3|SB1|SE1|SE2|SE5|SED|E1|E2)_/i,
  /^(F1|C5|C6|SC5|SC6)_/i,
];

// ─── Mapa de colunas → rótulo executivo ───────────────────────────────────────
const COLUMN_LABEL_MAP = [
  { pattern: /^MES(_FATURAMENTO|_VENDA|_EMISSAO|_REFERENCIA|_COMPETENCIA)?$/i, label: 'Mês' },
  { pattern: /^ANO(_FATURAMENTO|_VENDA|_EMISSAO)?$/i, label: 'Ano' },
  { pattern: /^(MES_ANO|ANO_MES|PERIODO|COMPETENCIA|REFERENCIA|MES_ANO_FATURAMENTO)$/i, label: 'Período' },
  { pattern: /SEMESTRE/i, label: 'Semestre' },
  { pattern: /TRIMESTRE|QUARTER/i, label: 'Trimestre' },
  { pattern: /SEMANA|WEEK/i, label: 'Semana' },
  { pattern: /VENDEDOR|REPRESENTANTE/i, label: 'Vendedor' },
  { pattern: /CLIENTE|CLIENT/i, label: 'Cliente' },
  { pattern: /FORNECEDOR|FORNEC/i, label: 'Fornecedor' },
  { pattern: /PRODUTO|ITEM/i, label: 'Produto' },
  { pattern: /FILIAL/i, label: 'Filial' },
  { pattern: /\bUF\b|ESTADO/i, label: 'Estado' },
  { pattern: /REGIAO|REGIÃO/i, label: 'Região' },
  { pattern: /CIDADE|MUNICIPIO/i, label: 'Cidade' },
  { pattern: /VALOR_TOTAL|FATURAMENTO|VALOR_FATURADO/i, label: 'Faturamento' },
  { pattern: /VALOR_BRUTO|VALBRUT/i, label: 'Valor Bruto' },
  { pattern: /VALOR_LIQUIDO|VALLIQ/i, label: 'Valor Líquido' },
  { pattern: /QUANTIDADE|QTDE|QUANT/i, label: 'Quantidade' },
  { pattern: /SALDO/i, label: 'Saldo' },
  { pattern: /LUCRO/i, label: 'Lucro' },
  { pattern: /CUSTO/i, label: 'Custo' },
  { pattern: /RECEITA/i, label: 'Receita' },
];

/**
 * Infere o tipo de dimensão temporal a partir do nome da coluna.
 * @param {string} colName
 * @returns {{ isTemporalDimension: boolean, granularity: string|null }}
 */
export function inferTimeDimensionType(colName) {
  if (!colName) return { isTemporalDimension: false, granularity: null };
  const upper = String(colName).toUpperCase();
  for (const { pattern, granularity } of TIME_DIMENSION_PATTERNS) {
    if (pattern.test(upper)) {
      return { isTemporalDimension: true, granularity };
    }
  }
  return { isTemporalDimension: false, granularity: null };
}

let _globalSemanticLabels = {};

/**
 * Define o dicionário semântico global vindo do backend/SX3.
 * @param {Record<string, string>} labelsMap
 */
export function setGlobalSemanticLabels(labelsMap) {
  _globalSemanticLabels = labelsMap || {};
}

/**
 * Humaniza o nome técnico de uma coluna para exibição ao usuário.
 * @param {string} colName
 * @param {Record<string, string>|null} customLabels
 * @returns {string}
 */
export function humanizeColumnName(colName, customLabels = null) {
  if (!colName) return '';
  const cleanKey = String(colName).trim();
  const upper = cleanKey.toUpperCase();

  // 1. Prioridade absoluta: dicionário semântico explícito do Protheus / SX3
  if (customLabels && customLabels[cleanKey]) return customLabels[cleanKey];
  if (customLabels && customLabels[upper]) return customLabels[upper];
  if (_globalSemanticLabels && _globalSemanticLabels[cleanKey]) return _globalSemanticLabels[cleanKey];
  if (_globalSemanticLabels && _globalSemanticLabels[upper]) return _globalSemanticLabels[upper];

  for (const { pattern, label } of COLUMN_LABEL_MAP) {
    if (pattern.test(upper)) return label;
  }

  let stripped = colName;
  for (const prefixRgx of PROTHEUS_PREFIXES) {
    stripped = stripped.replace(prefixRgx, '');
  }
  const strippedUpper = stripped.toUpperCase();
  if (strippedUpper !== upper) {
    if (customLabels && customLabels[strippedUpper]) return customLabels[strippedUpper];
    if (_globalSemanticLabels && _globalSemanticLabels[strippedUpper]) return _globalSemanticLabels[strippedUpper];
    for (const { pattern, label } of COLUMN_LABEL_MAP) {
      if (pattern.test(strippedUpper)) return label;
    }
  }

  return stripped
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

/** Extrai o número do mês (1-12) de um valor raw. Retorna string ou null. */
function extractMonthNumber(s) {
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 12) return String(n);
  }
  if (/^\d{6}$/.test(s)) {
    const n = parseInt(s.slice(4, 6), 10);
    if (n >= 1 && n <= 12) return String(n);
  }
  return null;
}

/** Humaniza período Mês/Ano (YYYYMM, YYYY/MM, MM/YYYY). */
function humanizeMonthYear(s) {
  if (/^\d{6}$/.test(s)) {
    const year = s.slice(0, 4);
    const month = parseInt(s.slice(4, 6), 10);
    if (month >= 1 && month <= 12) return `${MONTH_NAMES[String(month)]} ${year}`;
  }
  const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (m1) {
    const month = parseInt(m1[2], 10);
    if (month >= 1 && month <= 12) return `${MONTH_NAMES[String(month)]} ${m1[1]}`;
  }
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m2) {
    const month = parseInt(m2[1], 10);
    if (month >= 1 && month <= 12) return `${MONTH_NAMES[String(month)]} ${m2[2]}`;
  }
  return s;
}

/** Humaniza trimestre. */
function humanizeQuarter(s) {
  if (/^[1-4]$/.test(s)) return `${s}º Trimestre`;
  const m = s.match(/^(\d{4})[\/\-]([1-4])$|^([1-4])[\/\-](\d{4})$/);
  if (m) {
    const q = m[2] || m[3];
    const y = m[1] || m[4];
    return `${q}º Tri/${y}`;
  }
  return `Tri ${s}`;
}

/**
 * Humaniza o valor raw de uma dimensão com base no nome da coluna.
 * @param {string} colName
 * @param {string|number} rawValue
 * @returns {string}
 */
export function humanizeDimensionValue(colName, rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  const s = String(rawValue).trim();
  if (!s) return '';

  const { isTemporalDimension, granularity } = inferTimeDimensionType(colName);
  if (!isTemporalDimension) return s;

  switch (granularity) {
    case 'month': {
      const monthNum = extractMonthNumber(s);
      if (monthNum && MONTH_NAMES[monthNum]) return MONTH_NAMES[monthNum];
      return s;
    }
    case 'year':
      return s;
    case 'month_year':
      return humanizeMonthYear(s);
    case 'quarter':
      return humanizeQuarter(s);
    case 'semester':
      return /^[1-2]$/.test(s) ? `${s}º Semestre` : `Sem. ${s}`;
    case 'week':
      return `Semana ${s}`;
    default:
      return s;
  }
}

/**
 * Formata valor numérico em escala executiva.
 * @param {number} value
 * @param {'currency'|'percent'|'number'} format
 * @param {{ full?: boolean }} [options]
 * @returns {string}
 */
export function formatExecutiveValue(value, format = 'number', options = {}) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(n)) return '—';

  if (format === 'percent') {
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  const prefix = format === 'currency' ? 'R$ ' : '';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (!options.full) {
    if (abs >= 1_000_000_000) {
      return `${sign}${prefix}${(abs / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bi`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${prefix}${(abs / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Mi`;
    }
    if (abs >= 100_000) {
      return `${sign}${prefix}${(abs / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} K`;
    }
  }

  return `${sign}${prefix}${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Narrativas Executivas ────────────────────────────────────────────────────

function detectTrend(points) {
  if (!points || points.length < 2) return null;
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (typeof first !== 'number' || typeof last !== 'number') return null;
  const pct = first > 0 ? ((last - first) / first) * 100 : 0;
  if (pct > 5) return 'crescimento';
  if (pct < -5) return 'queda';
  return 'estável';
}

function _narrativeFinancial(kpis, charts, rows, totalLabel, leaderLabel, volumeLabel, backendKpis, backendInsights) {
  const totalKpi = kpis.find(k => k.type === 'sum' || k.type === 'receber' || k.type === 'pagar');
  const leaderChart = charts.find(c => c.chartType === 'bar' || c.chartType === 'donut');
  const leaderItem = leaderChart?.data?.[0];
  const parts = [];

  const totalVal = backendKpis?.total || totalKpi?.value || 0;
  const totalFormatted = formatExecutiveValue(totalVal, 'currency');
  const count = rows.length;

  if (totalLabel.toLowerCase().includes('vencido')) {
    parts.push(`Clientes em atraso somam **${totalFormatted}**, totalizando ${count} ${volumeLabel} em aberto.`);
  } else {
    parts.push(`O ${totalLabel.toLowerCase()} totaliza **${totalFormatted}** com ${count} ${volumeLabel}.`);
  }

  const leaderName = leaderItem?.label || leaderItem?.name || backendKpis?.maior_ocorrencia_nome;
  const leaderVal = leaderItem?.value || backendKpis?.maior_ocorrencia_valor || 0;
  const leaderShare = totalVal > 0 && leaderVal > 0 ? ((leaderVal / totalVal) * 100) : (backendKpis?.concentration || 0);

  if (leaderName && leaderShare > 0) {
    parts.push(`O principal devedor (**${leaderName}**) representa **${leaderShare.toFixed(1)}%** do total.`);
  }

  const top3Share = backendKpis?.top3_share;
  if (top3Share && top3Share > 0) {
    parts.push(`Os três maiores clientes concentram **${top3Share.toFixed(1)}%** da exposição.`);
  }

  const aging = backendKpis?.aging;
  if (aging && aging.pct_above_60 > 20) {
    parts.push(`Atenção: **${aging.pct_above_60.toFixed(1)}%** dos títulos possuem mais de 60 dias de atraso.`);
  }

  const trend = backendKpis?.trend;
  if (trend && trend.growth_pct > 5) {
    parts.push(`Foi observado crescimento de inadimplência nas últimas semanas (+${trend.growth_pct.toFixed(1)}%).`);
  }

  // Alerta prioritário dos insights da IA
  const topInsight = (backendInsights || []).find(i => i.severity === 'CRITICAL' || i.severity === 'WARNING');
  if (topInsight && !parts.some(p => p.includes(topInsight.title))) {
    parts.push(`*${topInsight.title}:* ${topInsight.description}`);
  }

  return parts.join(' ');
}

function _narrativeTimeSeries(kpis, charts, rows, schema, backendKpis) {
  const totalKpi = kpis.find(k => k.type === 'sum' || k.type === 'receber' || k.type === 'pagar');
  const lineSeries = charts.find(c => c.chartType === 'line');
  const points = lineSeries?.data || [];
  const trend = backendKpis?.trend?.direction || detectTrend(points);
  const growthPct = backendKpis?.trend?.growth_pct;
  const periodCount = points.length || rows.length;

  const isFinancial = schema?.primaryMeasure && /SALDO|RECEB|PAGAR|TITULO|FINANC/i.test(schema.primaryMeasure);
  const totalFormatted = totalKpi ? formatExecutiveValue(totalKpi.value, 'currency') : null;
  const bestPoint = points.length > 0 ? [...points].sort((a, b) => b.value - a.value)[0] : null;
  const bestLabel = bestPoint?.fullLabel || bestPoint?.label || '';
  const bestValue = bestPoint ? formatExecutiveValue(bestPoint.value, 'currency') : null;
  const bestShare = (totalKpi && bestPoint && totalKpi.value > 0)
    ? ((bestPoint.value / totalKpi.value) * 100).toFixed(1) : null;

  const top3Share = backendKpis?.top3_share || (totalKpi && totalKpi.value > 0 && points.length >= 3
    ? (([...points].sort((a, b) => b.value - a.value).slice(0, 3).reduce((acc, p) => acc + p.value, 0) / totalKpi.value) * 100).toFixed(1)
    : null);

  const trendText = trend === 'crescimento'
    ? (growthPct ? `tendência de crescimento (+${growthPct.toFixed(1)}%) ao longo do período` : 'tendência de crescimento ao longo do período')
    : trend === 'queda'
    ? (growthPct ? `retração de ${growthPct.toFixed(1)}% no período` : 'tendência de queda ao longo do período')
    : trend === 'estável' ? 'valores relativamente estáveis no período'
    : null;

  const parts = [];
  if (totalFormatted) {
    if (isFinancial) {
      parts.push(`O volume financeiro acumulado atingiu **${totalFormatted}** distribuído em ${periodCount} períodos.`);
    } else {
      parts.push(`O faturamento acumulado atingiu **${totalFormatted}** distribuído em ${periodCount} períodos.`);
    }
  }
  if (bestLabel && bestValue) {
    parts.push(`O melhor período foi **${bestLabel}** (${bestValue}${bestShare ? `, ${bestShare}% do total` : ''}).`);
  }
  if (top3Share && points.length >= 3) {
    if (isFinancial) {
      parts.push(`Os 3 maiores períodos concentram **${top3Share}%** do montante movimentado.`);
    } else {
      parts.push(`Os 3 maiores períodos concentram **${top3Share}%** das vendas.`);
    }
  }
  if (trendText) {
    parts.push(`Observa-se ${trendText}.`);
  }
  if (parts.length === 0) {
    parts.push(`Análise concluída. ${periodCount} registros no período.`);
  }
  return parts.join(' ');
}

function _narrativeRanking(kpis, charts, rows, schema, backendKpis) {
  const totalKpi = kpis.find(k => k.type === 'sum');
  const barChart = charts.find(c => c.chartType === 'bar' || c.chartType === 'donut');
  const topItem = barChart?.data?.[0];

  const entitySingular = schema?.hasProduct ? 'produto'
    : schema?.hasSeller ? 'vendedor'
    : schema?.hasCustomer ? 'cliente'
    : schema?.hasSupplier ? 'fornecedor'
    : schema?.hasGeographic ? 'região' : 'registro';
  const entityPlural = schema?.hasProduct ? 'produtos'
    : schema?.hasSeller ? 'vendedores'
    : schema?.hasCustomer ? 'clientes'
    : schema?.hasSupplier ? 'fornecedores'
    : schema?.hasGeographic ? 'regiões' : 'registros';

  const totalFormatted = totalKpi ? formatExecutiveValue(totalKpi.value, 'currency') : null;
  const entityCount = (barChart?.data || []).length || rows.length;
  const topLabel = backendKpis?.maior_ocorrencia_nome || topItem?.label || topItem?.name || '';
  const topValue = topItem ? formatExecutiveValue(topItem.value, 'currency') : null;
  const topShare = backendKpis?.concentration || ((totalKpi && topItem && totalKpi.value > 0)
    ? ((topItem.value / totalKpi.value) * 100).toFixed(1) : null);

  const top3Share = backendKpis?.top3_share || ((totalKpi && totalKpi.value > 0 && (barChart?.data || []).length >= 3)
    ? (((barChart?.data || []).slice(0, 3).reduce((acc, p) => acc + (p.value || 0), 0) / totalKpi.value) * 100).toFixed(1)
    : null);

  const parts = [];
  if (totalFormatted && entityCount > 0) {
    parts.push(`As vendas do período totalizaram **${totalFormatted}** entre ${entityCount} ${entityPlural}.`);
  }
  if (topLabel && topValue) {
    parts.push(`O ${entitySingular} líder foi **${topLabel}** com ${topValue}${topShare ? ` (${topShare}% de participação)` : ''}.`);
  }
  if (top3Share) {
    parts.push(`Os 3 primeiros concentram **${top3Share}%** do volume total.`);
  }
  if (parts.length === 0) {
    parts.push(`Análise concluída. ${rows.length} ${entityPlural} analisados.`);
  }
  return parts.join(' ');
}

/**
 * Gera o resumo executivo em linguagem natural.
 * Substitui buildExecutiveChatSummary no motor principal.
 * @param {object} analysisContext
 * @returns {string}
 */
export function buildExecutiveNarrative(analysisContext) {
  if (!analysisContext || !analysisContext.data) return 'Análise concluída.';

  const { data, schema, screenType } = analysisContext;
  const rows = data.rows || [];
  const kpis = data.kpis || [];
  const charts = data.charts || [];
  const backendKpis = data.backendKpis;
  const backendInsights = data.backendInsights || [];

  if (data.cashFlowData?.isCashFlow) {
    const { totalReceber, totalPagar, saldoProjetado } = data.cashFlowData;
    const status = saldoProjetado >= 0 ? 'superávit' : 'déficit';
    return [
      `O saldo projetado é de ${formatExecutiveValue(saldoProjetado, 'currency')} (${status}).`,
      `A receber: ${formatExecutiveValue(totalReceber, 'currency')} · A pagar: ${formatExecutiveValue(totalPagar, 'currency')}.`,
      `Analisados ${rows.length} títulos em aberto.`,
    ].join(' ');
  }

  if (screenType === 'overdue_receivables') {
    return _narrativeFinancial(kpis, charts, rows, 'Total Vencido em Aberto', 'Maior Devedor', 'títulos vencidos', backendKpis, backendInsights);
  }
  if (screenType === 'accounts_receivable') {
    return _narrativeFinancial(kpis, charts, rows, 'Total a Receber', 'Cliente com Maior Saldo', 'títulos em aberto', backendKpis, backendInsights);
  }
  if (screenType === 'accounts_payable') {
    return _narrativeFinancial(kpis, charts, rows, 'Total a Pagar', 'Fornecedor com Maior Saldo', 'títulos em aberto', backendKpis, backendInsights);
  }
  if (screenType === 'time_series') {
    return _narrativeTimeSeries(kpis, charts, rows, schema, backendKpis);
  }
  return _narrativeRanking(kpis, charts, rows, schema, backendKpis);
}

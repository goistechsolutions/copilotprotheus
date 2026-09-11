/**
 * Adaptive Dashboard Engine
 * 
 * Implementação em 3 camadas conforme especificação técnica:
 * 1. Schema & Semantic Analyzer (detecta tipos, cardinalidade e semântica)
 * 2. Dataset Classifier com Scoring (classifica em time_series, ranking, product_analysis, geographic, etc.)
 * 3. Component Factory (constrói KPIs, Gráficos inteligentes, Insights e Tabelas)
 */

// ─── 1. Padrões Semânticos Protheus ──────────────────────────────────────────
const SEMANTIC_PATTERNS = {
  customer: [
    'CLIENTE', 'COD_CLIENTE', 'F2_CLIENTE', 'CLIENT', 'A1_COD', 'A1_NOME', 'NOMCLI', 'NOME_CLIENTE'
  ],
  product: [
    'PRODUTO', 'ITEM', 'CODPROD', 'B1_COD', 'B1_DESC', 'DESCRICAO_PRODUTO', 'SERVICO'
  ],
  seller: [
    'VENDEDOR', 'REPRESENTANTE', 'A3_COD', 'A3_NOME', 'COD_VENDEDOR', 'NOME_VENDEDOR'
  ],
  branch: [
    'FILIAL', 'LOJA', 'FIL', 'F2_FILIAL', 'D2_FILIAL', 'E1_FILIAL', 'E2_FILIAL'
  ],
  date: [
    'DATA', 'MES', 'PERIODO', 'YEAR', 'ANO', 'EMISSAO', 'VENCTO', 'F2_EMISSAO', 'E1_VENCTO', 'E2_VENCTO', 'D2_EMISSAO', 'AID_DATA'
  ],
  geographic: [
    'UF', 'ESTADO', 'REGIAO', 'CIDADE', 'MUNICIPIO', 'A1_EST', 'A1_MUN', 'PAIS'
  ],
  measure: [
    'VALOR', 'FATURAMENTO', 'TOTAL', 'SALDO', 'RECEITA', 'QUANTIDADE', 'QTDE', 'PRECO', 'CUSTO', 'LUCRO', 'VALBRUT'
  ]
};

// ─── 2. Detecção de Tipo de Coluna ───────────────────────────────────────────
function isDateValue(val) {
  if (!val) return false;
  const s = String(val).trim();
  // Formato YYYYMMDD ou YYYY-MM-DD ou DD/MM/YYYY ou YYYYMM
  if (/^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return true;
  if (/^\d{4}\/(0[1-9]|1[0-2])$/.test(s)) return true;
  return false;
}

function isNumericValue(val) {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return Number.isFinite(val);
  const s = String(val).trim().replace(',', '.');
  return !isNaN(Number(s)) && !isDateValue(val);
}

export function analyzeSchema(rows, columns = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rowCount: 0, columns: [], semantics: {} };
  }

  const cols = columns.length > 0 ? columns : Object.keys(rows[0] || {});
  const sample = rows.slice(0, 100);

  const columnProfiles = cols.map(col => {
    const colUpper = String(col).toUpperCase();
    const values = sample.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');

    let dateCount = 0;
    let numericCount = 0;
    const distinctSet = new Set();

    rows.forEach(r => {
      const v = r[col];
      if (v !== null && v !== undefined && v !== '') distinctSet.add(v);
    });

    values.forEach(v => {
      if (isDateValue(v)) dateCount++;
      else if (isNumericValue(v)) numericCount++;
    });

    const isDate = dateCount / (values.length || 1) > 0.6 || SEMANTIC_PATTERNS.date.some(p => colUpper.includes(p));
    const isMeasure = !isDate && (numericCount / (values.length || 1) > 0.6 || SEMANTIC_PATTERNS.measure.some(p => colUpper.includes(p)));
    const type = isDate ? 'date' : (isMeasure ? 'measure' : 'dimension');

    return {
      name: col,
      type,
      distinct: distinctSet.size,
    };
  });

  // Detectar semântica
  const semantics = {};
  for (const [semKey, patterns] of Object.entries(SEMANTIC_PATTERNS)) {
    const matchedCol = columnProfiles.find(c => {
      const upper = c.name.toUpperCase();
      return patterns.some(p => upper === p || upper.includes(p));
    });
    if (matchedCol) {
      semantics[semKey] = matchedCol.name;
    }
  }

  const dateCols = columnProfiles.filter(c => c.type === 'date');
  const measureCols = columnProfiles.filter(c => c.type === 'measure');
  const dimCols = columnProfiles.filter(c => c.type === 'dimension');

  return {
    rowCount: rows.length,
    columns: columnProfiles,
    semantics,
    hasDate: dateCols.length > 0,
    hasCustomer: !!semantics.customer,
    hasProduct: !!semantics.product,
    hasSeller: !!semantics.seller,
    hasBranch: !!semantics.branch,
    hasGeographic: !!semantics.geographic,
    primaryMeasure: measureCols[0]?.name || null,
    measures: measureCols.map(c => c.name),
    dimensions: dimCols.map(c => c.name),
    dateColumns: dateCols.map(c => c.name),
  };
}

// ─── 3. Classificador de Dataset com Sistema de Pontuação (Score) ─────────────
export function classifyDataset(schema) {
  const scores = {
    time_series: 0,
    ranking: 0,
    product_analysis: 0,
    geographic: 0,
    composition: 0,
  };

  if (schema.hasDate) scores.time_series += 80;
  if (schema.hasCustomer) scores.ranking += 70;
  if (schema.hasProduct) scores.product_analysis += 70;
  if (schema.hasGeographic) scores.geographic += 80;

  // Cardinalidade para composição
  const singleDim = schema.columns.find(c => c.type === 'dimension');
  if (singleDim && singleDim.distinct > 1 && singleDim.distinct <= 7 && !schema.hasDate) {
    scores.composition += 60;
  }

  // Desempate
  if (schema.hasDate && (schema.hasCustomer || schema.hasProduct)) {
    scores.time_series += 20; // Prefere time_series se houver data
  }

  let bestType = 'ranking';
  let maxScore = -1;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  const confidence = Math.min(0.99, Math.max(0.60, maxScore / 100));

  return {
    datasetType: bestType,
    confidence: Number(confidence.toFixed(2)),
  };
}

// ─── 4. Fábrica de KPIs e Insights Adaptativos ────────────────────────────────
export function buildKPIs(schema, rows) {
  if (!rows || rows.length === 0 || !schema.primaryMeasure) return [];

  const measure = schema.primaryMeasure;
  let total = 0;
  let min = Infinity;
  let max = -Infinity;
  const values = [];

  rows.forEach(r => {
    const raw = r[measure];
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    if (!isNaN(n)) {
      total += n;
      values.push(n);
      if (n < min) min = n;
      if (n > max) max = n;
    }
  });

  const count = values.length || 1;
  const avg = total / count;

  const kpis = [
    {
      label: 'Total Acumulado',
      value: total,
      format: 'currency',
      type: 'sum',
    },
    {
      label: 'Média por Registro',
      value: avg,
      format: 'currency',
      type: 'avg',
    },
    {
      label: 'Maior Ocorrência',
      value: max === -Infinity ? 0 : max,
      format: 'currency',
      type: 'max',
    },
    {
      label: 'Total de Registros',
      value: count,
      format: 'number',
      type: 'count',
    }
  ];

  return kpis;
}

export function buildInsights(schema, rows) {
  if (!rows || rows.length === 0 || !schema.primaryMeasure) return [];

  const measure = schema.primaryMeasure;
  const dim = schema.semantics.customer || schema.semantics.product || schema.dimensions[0];
  const insights = [];

  if (dim) {
    // Agregação por dimensão
    const aggMap = new Map();
    let grandTotal = 0;

    rows.forEach(r => {
      const key = String(r[dim] || 'Outros');
      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
      aggMap.set(key, (aggMap.get(key) || 0) + val);
      grandTotal += val;
    });

    const sorted = [...aggMap.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && grandTotal > 0) {
      const [topKey, topVal] = sorted[0];
      const share = (topVal / grandTotal) * 100;

      insights.push({
        title: 'Concentração Principal',
        description: `O líder (${topKey}) representa ${share.toFixed(1)}% do montante total.`,
        value: `${share.toFixed(1)}%`,
        type: share > 30 ? 'critical' : 'information',
      });

      if (sorted.length >= 3) {
        const top3Val = sorted.slice(0, 3).reduce((acc, curr) => acc + curr[1], 0);
        const top3Share = (top3Val / grandTotal) * 100;
        insights.push({
          title: 'Curva ABC (Top 3)',
          description: `Os 3 maiores respondem por ${top3Share.toFixed(1)}% da movimentação geral.`,
          value: `${top3Share.toFixed(1)}%`,
          type: top3Share > 60 ? 'opportunity' : 'success',
        });
      }
    }
  }

  return insights;
}

// ─── 5. Fábrica de Gráficos Inteligentes Baseada em Cardinalidade ─────────────
export function buildCharts(schema, rows) {
  if (!rows || rows.length === 0 || !schema.primaryMeasure) return [];

  const measure = schema.primaryMeasure;
  const charts = [];

  // Se houver data: Gráfico de Linha / Tendência
  if (schema.hasDate) {
    const dateCol = schema.dateColumns[0];
    const dateAgg = new Map();

    rows.forEach(r => {
      const d = String(r[dateCol] || '');
      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
      dateAgg.set(d, (dateAgg.get(d) || 0) + val);
    });

    const points = [...dateAgg.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    charts.push({
      chartType: 'line',
      title: 'Evolução Temporal',
      xAxisKey: 'label',
      dataKey: 'value',
      data: points,
    });
  }

  // Gráficos por dimensão
  const dimCol = schema.semantics.customer || schema.semantics.product || schema.semantics.geographic || schema.dimensions[0];
  if (dimCol) {
    const dimProfile = schema.columns.find(c => c.name === dimCol);
    const distinctCount = dimProfile?.distinct || 10;

    const aggMap = new Map();
    rows.forEach(r => {
      const k = String(r[dimCol] || 'Outros');
      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
      aggMap.set(k, (aggMap.get(k) || 0) + val);
    });

    const sortedPoints = [...aggMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    // Regra da Cardinalidade:
    // Poucos valores (<= 6) -> Donut / Pizza / Composição
    // Muitos valores (> 6) -> Top 10 Bar Chart (Nunca pizza!)
    if (distinctCount <= 6 && !schema.hasDate) {
      charts.push({
        chartType: 'donut',
        title: `Distribuição por ${dimCol}`,
        data: sortedPoints.map(p => ({ ...p, name: p.label })),
        dataKey: 'value',
        nameKey: 'name',
      });
    } else {
      charts.push({
        chartType: 'bar',
        title: `Top 10 por ${dimCol}`,
        xAxisKey: 'label',
        dataKey: 'value',
        data: sortedPoints.slice(0, 10),
      });
    }
  }

  return charts;
}

// ─── 6. Pipeline Orquestrador Adaptativo ──────────────────────────────────────
export function buildAdaptiveDashboard(rows, columns = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const schema = analyzeSchema(rows, columns);
  const classification = classifyDataset(schema);
  const kpis = buildKPIs(schema, rows);
  const insights = buildInsights(schema, rows);
  const charts = buildCharts(schema, rows);

  return {
    screenType: classification.datasetType,
    confidence: classification.confidence,
    schema,
    data: {
      rows,
      columns: columns.length > 0 ? columns : Object.keys(rows[0] || {}),
      kpis,
      insights,
      charts,
      series: charts.filter(c => c.chartType === 'bar' || c.chartType === 'line').map(c => ({
        label: c.title,
        points: c.data,
      })),
    }
  };
}

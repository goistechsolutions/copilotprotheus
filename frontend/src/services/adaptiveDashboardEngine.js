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
    'VENDEDOR', 'REPRESENTANTE', 'A3_COD', 'A3_NOME', 'COD_VENDEDOR', 'CODIGO_VENDEDOR', 'NOME_VENDEDOR'
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
    'VALOR', 'FATURAMENTO', 'TOTAL', 'SALDO', 'RECEITA', 'QUANTIDADE', 'QTDE', 'PRECO', 'CUSTO', 'LUCRO', 'VALBRUT', 'VENDAS'
  ],
  cashFlowType: [
    'TIPO_MOVIMENTO', 'TIPO_MOV', 'TIPO', 'NATUREZA', 'MOVIMENTO'
  ]
};

// Valores que indicam estrutura de Fluxo de Caixa (RECEBIMENTO vs PAGAMENTO)
const CASH_FLOW_POSITIVE_TYPES = new Set(['RECEBIMENTO', 'RECEBER', 'A RECEBER', 'RECEITA', 'ENTRADA', 'CR', 'C']);
const CASH_FLOW_NEGATIVE_TYPES = new Set(['PAGAMENTO', 'PAGAR', 'A PAGAR', 'DESPESA', 'SAIDA', 'DR', 'D']);
const ALL_CASH_FLOW_TYPES = new Set([...CASH_FLOW_POSITIVE_TYPES, ...CASH_FLOW_NEGATIVE_TYPES]);


const IDENTIFIER_PATTERNS = [
  'COD', 'CODIGO', 'ID', 'NUM', 'NUMERO', 'DOC', 'SERIE', 'MAT', 'PREFIXO', 'PARCELA', 
  'CGC', 'CNPJ', 'CPF', 'CEP', 'FILIAL', 'LOJA', 'CHAVE'
];

function isIdentifierColumn(colName) {
  const upper = String(colName).toUpperCase();
  // Se contiver palavras explícitas de métrica financeira (ex: VALOR_TOTAL_VENDAS), não é puro identificador
  if (upper.includes('VALOR') || upper.includes('FATUR') || upper.includes('SALDO') || upper.includes('RECEITA')) {
    return false;
  }
  return IDENTIFIER_PATTERNS.some(p => {
    return upper === p || upper.startsWith(`${p}_`) || upper.endsWith(`_${p}`) || upper.includes(`_${p}_`);
  });
}

function hasLeadingZeroCodes(sampleValues) {
  return sampleValues.some(v => typeof v === 'string' && /^0\d+$/.test(v.trim()));
}

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

    const hasLeadingZeros = hasLeadingZeroCodes(values);
    const isIdCol = isIdentifierColumn(col);
    const hasMeasureKeyword = SEMANTIC_PATTERNS.measure.some(p => colUpper.includes(p));

    // Data só é válida se tiver formato ou padrão de data e NÃO for identificador
    const isDate = !isIdCol && (
      dateCount / (values.length || 1) > 0.6 || 
      (SEMANTIC_PATTERNS.date.some(p => colUpper.includes(p)) && !hasLeadingZeros)
    );

    // Dimensão semântica (cliente, vendedor, produto, filial, etc.)
    const isSemanticDimension = SEMANTIC_PATTERNS.customer.some(p => colUpper.includes(p)) ||
                                SEMANTIC_PATTERNS.seller.some(p => colUpper.includes(p)) ||
                                SEMANTIC_PATTERNS.product.some(p => colUpper.includes(p)) ||
                                SEMANTIC_PATTERNS.branch.some(p => colUpper.includes(p)) ||
                                SEMANTIC_PATTERNS.geographic.some(p => colUpper.includes(p));

    // Medida:
    // 1. Tem palavra-chave de medida (ex: VALOR_TOTAL_VENDAS) e não tem zeros à esquerda de código
    // 2. OU mais de 60% numérico, não é identificador, não tem zeros à esquerda, e não é dimensão
    const isMeasure = !isDate && (
      (hasMeasureKeyword && !hasLeadingZeros) ||
      (!isIdCol && !hasLeadingZeros && !isSemanticDimension && numericCount / (values.length || 1) > 0.6)
    );

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

  // Ordenação de medidas dando prioridade máxima para valores financeiros
  const sortedMeasures = [...measureCols].sort((a, b) => {
    const aUpper = a.name.toUpperCase();
    const bUpper = b.name.toUpperCase();
    
    const getWeight = (name) => {
      if (name.includes('VALOR') || name.includes('FATUR') || name.includes('RECEITA')) return 4;
      if (name.includes('TOTAL') || name.includes('SALDO') || name.includes('VENDAS')) return 3;
      if (name.includes('QUANT') || name.includes('QTDE')) return 2;
      return 1;
    };

    return getWeight(bUpper) - getWeight(aUpper);
  });

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
    primaryMeasure: sortedMeasures[0]?.name || null,
    measures: sortedMeasures.map(c => c.name),
    dimensions: dimCols.map(c => c.name),
    dateColumns: dateCols.map(c => c.name),
  };
}

// ─── 3. Classificador de Dataset com Sistema de Pontuação (Score) ─────────────
export function classifyDataset(schema) {
  const scores = {
    seller_ranking: 0,
    customer_ranking: 0,
    product_analysis: 0,
    geographic_distribution: 0,
    composition: 0,
    time_series: 0,
  };

  // Se houver data REAL, pontua time_series
  if (schema.hasDate) {
    scores.time_series += 80;
  }
  
  // Vendedor ou Cliente -> Ranking
  if (schema.hasSeller) scores.seller_ranking += 90;
  if (schema.hasCustomer) scores.customer_ranking += 85;
  if (schema.hasProduct) scores.product_analysis += 85;
  if (schema.hasGeographic) scores.geographic_distribution += 85;

  // Cardinalidade para composição
  const singleDim = schema.columns.find(c => c.type === 'dimension');
  if (singleDim && singleDim.distinct > 1 && singleDim.distinct <= 6 && !schema.hasDate) {
    scores.composition += 70;
  }

  // Se houver data E entidade, time_series ganha bônus
  if (schema.hasDate && (schema.hasCustomer || schema.hasProduct || schema.hasSeller)) {
    scores.time_series += 20;
  }

  // Se NÃO houver data, zera time_series
  if (!schema.hasDate) {
    scores.time_series = 0;
  }

  let bestType = 'seller_ranking';
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  // Fallback seguro
  if (maxScore === 0) {
    bestType = schema.hasDate ? 'time_series' : (schema.hasCustomer ? 'customer_ranking' : 'seller_ranking');
    maxScore = 75;
  }

  const confidence = Math.min(0.99, Math.max(0.70, maxScore / 100));

  return {
    datasetType: bestType,
    confidence: Number(confidence.toFixed(2)),
  };
}

// ─── 3.1. Semântica de apresentação ─────────────────────────────────────────
// O dashboard não pode chamar toda medida numérica de "faturamento". A
// intenção/domínio e o nome físico da medida são as únicas evidências
// disponíveis nesta camada; na ausência delas, usamos um rótulo neutro.
const PRESENTATION_ALIASES = {
  cash_flow: 'finance',
  receivables: 'finance',
  payables: 'finance',
  sales_billing: 'sales',
  billing: 'sales',
  finance: 'finance',
  sales: 'sales',
};

function normalizePresentationContext(context = {}) {
  const source = context?.metadata || context?.semantic || context || {};
  const rawIntent = String(source.intent || source.intent_code || '').trim().toLowerCase();
  const rawDomain = String(source.domain || source.domain_code || '').trim().toLowerCase();
  const intent = rawIntent || null;
  const domain = PRESENTATION_ALIASES[rawIntent] || rawDomain || null;

  return {
    intent,
    domain,
    measureLabel: source.measureLabel || source.measure_label || null,
    measureFormat: source.measureFormat || source.measure_format || null,
  };
}

function humanizeMeasureName(measure) {
  return String(measure || 'medida')
    .replace(/^(TOTAL_|VALOR_|SUM_|AVG_)/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function inferPresentationDomain(schema) {
  const columns = (schema?.columns || []).map(column => String(column.name || '').toUpperCase());
  const hasFinanceEvidence = columns.some(column =>
    /^(E1|E2|E5)(_|$)/.test(column) || /(RECEB|A_RECEBER|PAGAR|A_PAGAR|SALDO_FINANCEIRO)/.test(column)
  );
  const hasSalesEvidence = columns.some(column =>
    /^(F2|D2|C5|C6)(_|$)/.test(column) || /FATURAMENTO|VALOR_FATURADO/.test(column)
  );

  if (hasFinanceEvidence && !hasSalesEvidence) return 'finance';
  if (hasSalesEvidence && !hasFinanceEvidence) return 'sales';
  return null;
}

function resolveMeasurePresentation(schema, context = {}) {
  const explicitPresentation = normalizePresentationContext(context);
  const presentation = {
    ...explicitPresentation,
    domain: explicitPresentation.domain || inferPresentationDomain(schema),
  };
  const measure = schema?.primaryMeasure || '';
  const upperMeasure = String(measure).toUpperCase();
  const isCurrencyMeasure = /(VALOR|FATUR|RECEITA|SALDO|PRECO|CUSTO|LUCRO|TOTAL)/.test(upperMeasure);

  let label = presentation.measureLabel;
  if (!label) {
    if (presentation.domain === 'finance' || presentation.intent === 'cash_flow' || presentation.intent === 'finance') {
      if (/(RECEB|RECEIVER|A_RECEBER)/.test(upperMeasure)) label = 'Total a receber';
      else if (/(PAGAR|PAGAMENTO|A_PAGAR)/.test(upperMeasure)) label = 'Total a pagar';
      else if (upperMeasure.includes('SALDO')) label = 'Saldo financeiro';
      else label = 'Total financeiro analisado';
    } else if (presentation.domain === 'sales') {
      label = 'Faturamento total';
    } else {
      label = `Total de ${humanizeMeasureName(measure)}`;
    }
  }

  const format = presentation.measureFormat || (isCurrencyMeasure ? 'currency' : 'number');
  return { ...presentation, label, format };
}

// ─── 4. Fábrica de KPIs e Insights Adaptativos ────────────────────────────────
export function buildKPIs(schema, rows, presentationContext = {}) {
  if (!rows || rows.length === 0 || !schema.primaryMeasure) return [];

  const measure = schema.primaryMeasure;
  const presentation = resolveMeasurePresentation(schema, presentationContext);
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
      label: presentation.label,
      value: total,
      format: presentation.format,
      type: 'sum',
    },
    {
      label: 'Média por Registro',
      value: avg,
      format: presentation.format,
      type: 'avg',
    },
    {
      label: presentation.format === 'currency' ? 'Maior Ocorrência' : 'Maior Valor',
      value: max === -Infinity ? 0 : max,
      format: presentation.format,
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

export function buildInsights(schema, rows, backendKpis = null) {
  if (!rows || rows.length === 0 || !schema.primaryMeasure) return [];

  // Se o backend forneceu KPIs validados, use-os como fonte única da verdade
  if (backendKpis && backendKpis.top_items && backendKpis.top_items.length > 0 && !backendKpis.error) {
    const insights = [];
    const top = backendKpis.top_items[0];
    const conc = backendKpis.concentration;
    const dim = schema.semantics.seller || schema.semantics.customer || schema.semantics.product || schema.semantics.geographic || schema.dimensions[0];
    const dimLabel = schema.semantics.seller === dim ? 'vendedor' :
                     schema.semantics.customer === dim ? 'cliente' :
                     schema.semantics.product === dim ? 'produto' : 'registro';

    if (conc != null) {
      insights.push({
        title: 'Concentração Principal',
        description: `O principal ${dimLabel} (${top.name}) representa ${conc.toFixed(1)}% do total movimentado.`,
        value: `${conc.toFixed(1)}%`,
        type: conc > 30 ? 'critical' : 'information',
      });
    }

    if (backendKpis.top_items.length >= 3) {
      const top3Share = backendKpis.top_items.slice(0, 3).reduce((acc, i) => acc + (i.share_percent || 0), 0);
      insights.push({
        title: 'Curva ABC (Top 3)',
        description: `Os 3 maiores respondem por ${top3Share.toFixed(1)}% da movimentação geral.`,
        value: `${top3Share.toFixed(1)}%`,
        type: top3Share > 60 ? 'opportunity' : 'success',
      });
    }
    return insights;
  }

  const measure = schema.primaryMeasure;
  const dim = schema.semantics.seller || schema.semantics.customer || schema.semantics.product || schema.semantics.geographic || schema.dimensions[0];
  const insights = [];

  if (dim) {
    // Passo 1: Agregar por dimensão primeiro
    const aggMap = new Map();
    rows.forEach(r => {
      const key = String(r[dim] || 'Outros');
      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
      aggMap.set(key, (aggMap.get(key) || 0) + val);
    });

    // Passo 2: Denominador é a SOMA DOS MÓDULOS dos grupos — nunca o saldo líquido
    // Isso evita share > 100% quando há RECEITA (+) e DESPESA (-) misturados.
    // Ex: RECEITA=15M, DESPESA=-14.4M → saldo=614k → share ERRADO = 15M/614k = 2444%
    //                                  → abs_total=29.4M → share CORRETO = 15M/29.4M = 51%
    const absTotal = [...aggMap.values()].reduce((acc, v) => acc + Math.abs(v), 0);

    const sorted = [...aggMap.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (sorted.length > 0 && absTotal > 0) {
      const [topKey, topVal] = sorted[0];
      const share = (Math.abs(topVal) / absTotal) * 100;

      const dimLabel = schema.semantics.seller === dim ? 'vendedor' :
                       schema.semantics.customer === dim ? 'cliente' :
                       schema.semantics.product === dim ? 'produto' : 'registro';

      insights.push({
        title: 'Concentração Principal',
        description: `O principal ${dimLabel} (${topKey}) representa ${share.toFixed(1)}% do total movimentado.`,
        value: `${share.toFixed(1)}%`,
        type: share > 30 ? 'critical' : 'information',
      });

      if (sorted.length >= 3) {
        const top3AbsVal = sorted.slice(0, 3).reduce((acc, [, v]) => acc + Math.abs(v), 0);
        const top3Share = (top3AbsVal / absTotal) * 100;
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
  const dimCol = schema.semantics.seller || schema.semantics.customer || schema.semantics.product || schema.semantics.geographic || schema.dimensions[0];
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

    const dimLabel = schema.semantics.seller === dimCol ? 'Vendedor' :
                     schema.semantics.customer === dimCol ? 'Cliente' :
                     schema.semantics.product === dimCol ? 'Produto' :
                     schema.semantics.geographic === dimCol ? 'Região' : dimCol;

    // Regra da Cardinalidade:
    // Poucos valores (<= 6) -> Donut / Pizza / Composição
    // Muitos valores (> 6) -> Top 10 Bar Chart (Nunca pizza!)
    if (distinctCount <= 6 && !schema.hasDate) {
      charts.push({
        chartType: 'donut',
        title: `Distribuição por ${dimLabel}`,
        data: sortedPoints.map(p => ({ ...p, name: p.label })),
        dataKey: 'value',
        nameKey: 'name',
      });
    } else {
      charts.push({
        chartType: 'bar',
        title: `Top 10 por ${dimLabel}`,
        xAxisKey: 'label',
        dataKey: 'value',
        data: sortedPoints.slice(0, 10),
      });
    }
  }

  return charts;
}

// ─── 6. Motor de Sugestões Automáticas Contextuais ────────────────────────────
export function generateContextualSuggestions(schema, data = {}) {
  const suggestions = [];
  const charts = data.charts || [];
  const topItem = charts[0]?.data?.[0]?.label;

  if (schema.hasSeller) {
    suggestions.push('Mostrar Top 20 vendedores');
    suggestions.push('Comparar com mês anterior');
    suggestions.push('Analisar tendência');
    if (topItem) {
      suggestions.push(`Clientes do vendedor ${topItem}`);
    }
  } else if (schema.hasCustomer) {
    suggestions.push('Histórico de compras do cliente líder');
    suggestions.push('Produtos mais comprados por clientes');
    suggestions.push('Clientes sem compras recentes');
    if (topItem) {
      suggestions.push(`Detalhamento do cliente ${topItem}`);
    }
  } else if (schema.hasProduct) {
    suggestions.push('Curva ABC completa de produtos');
    suggestions.push('Produtos com maior volume');
    suggestions.push('Vendas por linha de produto');
    if (topItem) {
      suggestions.push(`Clientes que compram o produto ${topItem}`);
    }
  } else if (schema.hasDate) {
    suggestions.push('Comparar ano atual vs ano anterior');
    suggestions.push('Identificar período de pico');
    suggestions.push('Projeção para os próximos 30 dias');
    suggestions.push('Detalhamento semanal');
  } else {
    suggestions.push('Filtrar pelos 10 maiores');
    suggestions.push('Comparar com período anterior');
    suggestions.push('Analisar tendência');
  }

  return suggestions.slice(0, 4);
}

// ─── 7. Detector e Motor de Fluxo de Caixa ──────────────────────────────────
/**
 * Detecta se os dados representam um Fluxo de Caixa (RECEBIMENTO vs PAGAMENTO)
 * Retorna null se não for fluxo de caixa, ou um objeto cashFlowData com os dados processados.
 */
export function detectCashFlow(schema, rows) {
  if (!rows || rows.length === 0) return null;

  const columns = schema.columns || Object.keys(rows[0] || {}).map(k => ({ name: k }));
  let typeCol = null;

  // 1. Procura por valores explícitos nas primeiras 50 linhas de cada coluna
  for (const c of columns) {
    const colName = typeof c === 'string' ? c : (c.name || c.key || '');
    if (!colName) continue;
    const sampleValues = [...new Set(rows.slice(0, 50).map(r => String(r[colName] || '').toUpperCase().trim()))];
    const matchCount = sampleValues.filter(v => ALL_CASH_FLOW_TYPES.has(v)).length;
    if (matchCount > 0) {
      typeCol = colName;
      break;
    }
  }

  // 2. Fallback: Procura por nome de coluna
  if (!typeCol) {
    const typeCols = (schema.columns || []).filter(c => {
      const upper = (c.name || '').toUpperCase();
      return SEMANTIC_PATTERNS.cashFlowType.some(p => upper === p || upper.includes(p));
    });
    if (typeCols.length > 0) typeCol = typeCols[0].name;
  }

  if (!typeCol) return null;

  // Coluna de valor/medida
  let measure = schema.primaryMeasure;
  if (!measure) {
    for (const k of Object.keys(rows[0] || {})) {
      const upper = k.toUpperCase();
      if (upper.includes('VALOR') || upper.includes('SALDO') || upper.includes('TOTAL') || upper.includes('VALBRUT')) {
        measure = k;
        break;
      }
    }
  }
  if (!measure) return null;

  // Coluna de data
  let dateCol = schema.dateColumns?.[0] || null;
  if (!dateCol) {
    for (const k of Object.keys(rows[0] || {})) {
      const upper = k.toUpperCase();
      if (SEMANTIC_PATTERNS.date.some(p => upper.includes(p)) || isDateColumn(k, rows)) {
        dateCol = k;
        break;
      }
    }
  }

  // Agregar por tipo e por data
  const byType = {};
  const byDate = {};

  rows.forEach(r => {
    const tipo = String(r[typeCol] || '').toUpperCase().trim();
    const raw = r[measure];
    const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;
    const absVal = Math.abs(val);

    if (!byType[tipo]) byType[tipo] = 0;

    if (CASH_FLOW_POSITIVE_TYPES.has(tipo)) {
      byType[tipo] += absVal;
    } else if (CASH_FLOW_NEGATIVE_TYPES.has(tipo)) {
      byType[tipo] += absVal;
    } else {
      byType[tipo] += val;
    }

    if (dateCol) {
      const rawDate = String(r[dateCol] || '').trim();
      const dateKey = formatDateLabel(rawDate) || 'Geral';
      if (!byDate[dateKey]) byDate[dateKey] = { rawDate, RECEBIMENTO: 0, PAGAMENTO: 0 };
      if (CASH_FLOW_POSITIVE_TYPES.has(tipo)) {
        byDate[dateKey].RECEBIMENTO += absVal;
      } else if (CASH_FLOW_NEGATIVE_TYPES.has(tipo)) {
        byDate[dateKey].PAGAMENTO += absVal;
      }
    }
  });

  // Calcular totais
  let totalReceber = 0;
  let totalPagar = 0;
  Object.entries(byType).forEach(([tipo, val]) => {
    if (CASH_FLOW_POSITIVE_TYPES.has(tipo)) totalReceber += val;
    else if (CASH_FLOW_NEGATIVE_TYPES.has(tipo)) totalPagar += val;
  });

  const saldoProjetado = totalReceber - totalPagar;

  // Série temporal por data (para gráfico de barras agrupadas e linha de diferença)
  const dailySeries = Object.entries(byDate)
    .sort(([, a], [, b]) => String(a.rawDate).localeCompare(String(b.rawDate)))
    .map(([date, vals]) => ({
      date,
      RECEBIMENTO: vals.RECEBIMENTO,
      PAGAMENTO: vals.PAGAMENTO,
      SALDO: vals.RECEBIMENTO - vals.PAGAMENTO,
      label: date,
      value: vals.RECEBIMENTO - vals.PAGAMENTO,
    }));

  return {
    isCashFlow: true,
    typeCol,
    dateCol,
    measure,
    totalReceber,
    totalPagar,
    saldoProjetado,
    dailySeries,
    byType,
  };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return dateStr;
  const s = String(dateStr).trim();
  // Formato YYYYMMDD → DD/MM
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(6, 8)}/${s.slice(4, 6)}`;
  }
  // Formato YYYY-MM-DD → DD/MM
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.split('-');
    return `${parts[2].slice(0, 2)}/${parts[1]}`;
  }
  // Formato DD/MM/YYYY → DD/MM
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    return s.slice(0, 5);
  }
  return s;
}

export function buildCashFlowKPIs(cashFlowData) {
  const { totalReceber, totalPagar, saldoProjetado } = cashFlowData;
  return [
    {
      label: 'Total em Aberto a Receber',
      value: totalReceber,
      format: 'currency',
      type: 'receber',
    },
    {
      label: 'Total em Aberto a Pagar',
      value: totalPagar,
      format: 'currency',
      type: 'pagar',
    },
    {
      label: 'Saldo Projetado (Diferença)',
      value: saldoProjetado,
      format: 'currency',
      type: 'saldo',
    },
    {
      label: 'Total de Títulos em Aberto',
      value: 0,
      format: 'number',
      type: 'count',
    },
  ];
}

export function buildCashFlowCharts(cashFlowData) {
  const charts = [];
  const { dailySeries, byType } = cashFlowData;

  // Gráfico 1: Barras agrupadas por dia (A Receber vs A Pagar)
  if (dailySeries.length > 0) {
    charts.push({
      chartType: 'grouped_bar',
      title: 'Comparativo Diário: A Receber vs A Pagar',
      xAxisKey: 'date',
      series: [
        { dataKey: 'RECEBIMENTO', label: 'A Receber', color: '#10b981' },
        { dataKey: 'PAGAMENTO', label: 'A Pagar', color: '#ef4444' },
      ],
      data: dailySeries,
    });

    // Gráfico 2: Linha de análise de diferença (Saldo Líquido por Dia)
    charts.push({
      chartType: 'line',
      title: 'Análise de Diferença Diária (Saldo Projetado)',
      xAxisKey: 'date',
      dataKey: 'SALDO',
      data: dailySeries.map(d => ({ date: d.date, label: d.date, value: d.SALDO, SALDO: d.SALDO })),
      referenceLineY: 0,
      color: '#3b82f6',
    });
  } else {
    // Sem data: apenas barra comparativa A Receber vs A Pagar total
    const comparisonData = [
      { label: 'A Receber', value: cashFlowData.totalReceber },
      { label: 'A Pagar', value: cashFlowData.totalPagar },
    ];

    charts.push({
      chartType: 'bar',
      title: 'Comparativo Geral: A Receber vs A Pagar',
      xAxisKey: 'label',
      dataKey: 'value',
      color: '#3b82f6',
      data: comparisonData,
    });
  }

  return charts;
}


export function buildCashFlowInsights(cashFlowData) {
  const { totalReceber, totalPagar, saldoProjetado, dailySeries } = cashFlowData;
  const insights = [];
  const absTotal = totalReceber + totalPagar;
  if (absTotal === 0) return insights;

  const shareReceber = (totalReceber / absTotal) * 100;
  const sharePagar = (totalPagar / absTotal) * 100;

  insights.push({
    title: saldoProjetado >= 0 ? 'Saldo Positivo' : 'Atenção: Saldo Negativo',
    description: saldoProjetado >= 0
      ? `Os recebimentos superam os pagamentos em R$ ${Math.abs(saldoProjetado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      : `Os pagamentos superam os recebimentos em R$ ${Math.abs(saldoProjetado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Risco de caixa no período.`,
    value: saldoProjetado >= 0 ? '✓ Positivo' : '⚠ Negativo',
    type: saldoProjetado >= 0 ? 'success' : 'critical',
  });

  insights.push({
    title: 'Composição do Fluxo',
    description: `Recebimentos representam ${shareReceber.toFixed(1)}% e pagamentos ${sharePagar.toFixed(1)}% do volume bruto total.`,
    value: `${shareReceber.toFixed(1)}% / ${sharePagar.toFixed(1)}%`,
    type: 'information',
  });

  // Dia com maior diferença negativa (pico de caixa negativo)
  if (dailySeries.length > 0) {
    const worstDay = dailySeries.reduce((min, d) => d.SALDO < min.SALDO ? d : min, dailySeries[0]);
    if (worstDay.SALDO < 0) {
      insights.push({
        title: 'Pico de Pressão de Caixa',
        description: `O dia ${worstDay.date} possui o maior déficit: R$ ${Math.abs(worstDay.SALDO).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        value: worstDay.date,
        type: 'critical',
      });
    }
  }

  return insights;
}

// ─── 8. Chat Response Builder (Resumo Executivo Conciso) ───────────────────
export function buildExecutiveChatSummary(context) {
  if (!context || !context.data) return 'Análise concluída com sucesso.';

  const { data, schema } = context;
  const rows = data.rows || [];
  const count = rows.length;

  // Se for fluxo de caixa, usa formatação específica
  if (data.cashFlowData?.isCashFlow) {
    const { totalReceber, totalPagar, saldoProjetado } = data.cashFlowData;
    const statusSaldo = saldoProjetado >= 0 ? '✓ (Superávit projetado)' : '⚠ (Déficit projetado)';
    const parts = ['**Resumo do Fluxo de Caixa (Próximos Dias):**\n'];
    parts.push(`• **Total em Aberto a Receber:** R$ ${fmt(totalReceber)}`);
    parts.push(`• **Total em Aberto a Pagar:** R$ ${fmt(totalPagar)}`);
    parts.push(`• **Saldo Projetado (Diferença):** R$ ${fmt(saldoProjetado)} ${statusSaldo}`);
    parts.push(`• **Títulos em Aberto:** ${count} registros analisados`);
    return parts.join('\n');
  }


  const totalKpi = data.kpis?.find(k => k.type === 'sum');

  // Identifica o líder a partir do primeiro gráfico ou dos dados agrupados
  const barChart = data.charts?.find(c => c.chartType === 'bar' || c.chartType === 'donut');
  const leaderItem = barChart?.data?.[0];
  const leaderLabel = leaderItem?.label || leaderItem?.name;
  const leaderValue = leaderItem?.value;
  const presentation = resolveMeasurePresentation(schema, context);

  const entitySingular = schema.hasSeller ? 'Vendedor líder' :
                         schema.hasCustomer ? 'Cliente líder' :
                         schema.hasProduct ? 'Produto líder' :
                         schema.hasGeographic ? 'Região líder' :
                         schema.dimensions?.length ? 'Dimensão de maior valor' : 'Maior ocorrência';

  const entityPlural = schema.hasSeller ? 'vendedores' :
                       schema.hasCustomer ? 'clientes' :
                       schema.hasProduct ? 'produtos' :
                       schema.hasGeographic ? 'regiões' : 'registros';

  const parts = ['**Resumo da Análise:**\n'];

  if (totalKpi) {
    const formattedTotal = totalKpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalValue = totalKpi.format === 'currency' ? `R$ ${formattedTotal}` : formattedTotal;
    parts.push(`• **${presentation.label}:** ${totalValue}`);
  }

  if (leaderLabel && leaderValue != null) {
    const formattedLeaderVal = typeof leaderValue === 'number'
      ? leaderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : leaderValue;
    const leaderValueText = totalKpi?.format === 'currency' ? `R$ ${formattedLeaderVal}` : formattedLeaderVal;
    parts.push(`• **${entitySingular}:** ${leaderLabel} (${leaderValueText})`);
  }

  parts.push(`• **Volume:** ${count} ${entityPlural} analisados`);

  return parts.join('\n');
}

// ─── 9. Pipeline Orquestrador Adaptativo ──────────────────────────────────────
export function buildAdaptiveDashboard(rows, columns = [], semanticContext = {}, backendKpis = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const schema = analyzeSchema(rows, columns);
  const presentation = resolveMeasurePresentation(schema, semanticContext);

  // Detecta padrão de Fluxo de Caixa antes de qualquer classificação genérica
  const cashFlowData = detectCashFlow(schema, rows);

  let kpis, insights, charts, screenType, confidence;

  if (cashFlowData) {
    // Caminho especializado: Fluxo de Caixa
    kpis = buildCashFlowKPIs(cashFlowData);
    // Atualizar count de títulos
    kpis[3] = { ...kpis[3], value: rows.length };
    insights = buildCashFlowInsights(cashFlowData);
    charts = buildCashFlowCharts(cashFlowData);
    screenType = 'cash_flow';
    confidence = 0.99;
  } else {
    // Caminho genérico existente
    const classification = classifyDataset(schema);
    kpis = buildKPIs(schema, rows, semanticContext);
    // Priorizar KPIs do backend quando disponíveis para evitar divergência chat/dashboard
    insights = buildInsights(schema, rows, backendKpis);
    charts = buildCharts(schema, rows);
    screenType = classification.datasetType;
    confidence = classification.confidence;
  }

  const contextData = {
    rows,
    columns: columns.length > 0 ? columns : Object.keys(rows[0] || {}),
    kpis,
    insights,
    charts,
    backendKpis,
    cashFlowData,
    series: charts.filter(c => c.chartType === 'bar' || c.chartType === 'line' || c.chartType === 'grouped_bar').map(c => ({
      label: c.title,
      points: c.data,
    })),
  };

  const suggestions = cashFlowData
    ? [
        'Fluxo de caixa dos próximos 15 dias',
        'Títulos vencidos a receber',
        'Clientes com maior volume a pagar',
        'Comparar com semana anterior',
      ]
    : generateContextualSuggestions(schema, contextData);

  const analysisContext = {
    screenType,
    confidence,
    schema,
    suggestions,
    data: contextData,
    presentation,
    intent: presentation.intent,
    domain: cashFlowData ? 'finance' : presentation.domain,
  };

  analysisContext.executiveSummary = buildExecutiveChatSummary(analysisContext);

  return analysisContext;
}

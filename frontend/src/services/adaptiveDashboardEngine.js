/**
 * Adaptive Dashboard Engine
 * 
 * Implementação em 3 camadas conforme especificação técnica:
 * 1. Schema & Semantic Analyzer (detecta tipos, cardinalidade e semântica)
 * 2. Dataset Classifier com Scoring (classifica em time_series, ranking, product_analysis, geographic, etc.)
 * 3. Component Factory (constrói KPIs, Gráficos inteligentes, Insights e Tabelas)
 */

import {
  inferTimeDimensionType,
  humanizeDimensionValue,
  humanizeColumnName,
  buildExecutiveNarrative,
  setGlobalSemanticLabels,
} from './presentationIntelligence.js';
import {
  buildReceivablesDashboard,
  buildTimeSeriesDashboard,
  buildInventoryDashboard,
} from './dashboardFactory.js';

// ─── 1. Padrões Semânticos Protheus ──────────────────────────────────────────
// Aliases exatos de entidades (ambíguos entre código e nome, dependem de isLikelyTextName)
export const SEMANTIC_EXACT_ALIASES = {
  customer: ['CLIENTE', 'CLIENT'],
  supplier: ['FORNECEDOR', 'FORNEC'],
  seller: ['VENDEDOR', 'REPRESENTANTE'],
  product: ['PRODUTO', 'ITEM'],
};

// Padrões específicos para nomes/descrições (prioridade máxima para exibição em gráficos e eixos)
const SEMANTIC_NAME_PATTERNS = {
  customer: [
    'NOMCLI', 'E1_NOMCLI', 'NOME_CLIENTE', 'A1_NOME', 'A1_NREDUZ', 'CLIENTE_NOME', 'RAZAO_SOCIAL', 'NOME_CLI', 'CLIENT_NAME', 'NOM_CLIENTE'
  ],
  supplier: [
    'NOMFOR', 'E2_NOMFOR', 'NOME_FORNECEDOR', 'A2_NOME', 'A2_NREDUZ', 'FORNECEDOR_NOME', 'NOM_FORNECEDOR', 'RAZAO_SOCIAL', 'NOME_FORN'
  ],
  seller: [
    'NOME_VENDEDOR', 'A3_NOME', 'A3_NREDUZ', 'VENDEDOR_NOME', 'NOM_VENDEDOR', 'REPRESENTANTE_NOME', 'NOME_VEND'
  ],
  product: [
    'B1_DESC', 'DESCRICAO', 'DESCR', 'DESC_PRODUTO', 'NOME_PRODUTO', 'PRODUTO_DESC'
  ],
};

// Padrões de códigos/identificadores (usados como fallback quando não há coluna de nome)
const SEMANTIC_CODE_PATTERNS = {
  customer: [
    'E1_CLIENTE', 'A1_COD', 'COD_CLIENTE', 'COD_CLI', 'CODIGO_CLIENTE', 'F2_CLIENTE'
  ],
  supplier: [
    'E2_FORNECE', 'A2_COD', 'COD_FORNECEDOR', 'COD_FORN', 'CODIGO_FORNECEDOR', 'F1_FORNECE', 'FORNECE'
  ],
  seller: [
    'A3_COD', 'COD_VENDEDOR', 'CODIGO_VENDEDOR', 'COD_VEND', 'F2_VEND1', 'F2_VEND', 'C5_VEND1', 'C5_VEND', 'D2_VENDEDOR', 'COD_REPR'
  ],
  product: [
    'B1_COD', 'D2_COD', 'D1_COD', 'COD_PRODUTO', 'COD_PROD', 'CODIGO_PRODUTO'
  ],
};

const SEMANTIC_PATTERNS = {
  customer: [
    ...SEMANTIC_NAME_PATTERNS.customer,
    ...SEMANTIC_CODE_PATTERNS.customer,
    ...SEMANTIC_EXACT_ALIASES.customer,
  ],
  supplier: [
    ...SEMANTIC_NAME_PATTERNS.supplier,
    ...SEMANTIC_CODE_PATTERNS.supplier,
    ...SEMANTIC_EXACT_ALIASES.supplier,
  ],
  seller: [
    ...SEMANTIC_NAME_PATTERNS.seller,
    ...SEMANTIC_CODE_PATTERNS.seller,
    ...SEMANTIC_EXACT_ALIASES.seller,
  ],
  product: [
    ...SEMANTIC_NAME_PATTERNS.product,
    ...SEMANTIC_CODE_PATTERNS.product,
    ...SEMANTIC_EXACT_ALIASES.product,
  ],
  branch: [
    'FILIAL', 'LOJA', 'FIL', 'F2_FILIAL', 'D2_FILIAL', 'E1_FILIAL', 'E2_FILIAL'
  ],
  date: [
    'DATA', 'MES', 'PERIODO', 'YEAR', 'ANO', 'EMISSAO', 'VENCTO', 'F2_EMISSAO', 'E1_VENCTO', 'E2_VENCTO', 'D2_EMISSAO', 'AID_DATA',
    'DATA_VENCTO', 'E1_EMISSAO', 'E2_EMISSAO', 'VENCTO_REAL', 'DT_VENCTO'
  ],
  geographic: [
    'UF', 'ESTADO', 'REGIAO', 'CIDADE', 'MUNICIPIO', 'A1_EST', 'A1_MUN', 'PAIS'
  ],
  measure: [
    'VALOR', 'FATURAMENTO', 'TOTAL', 'SALDO', 'RECEITA', 'QUANTIDADE', 'QTDE', 'PRECO', 'CUSTO', 'LUCRO', 'VALBRUT', 'VENDAS',
    'E1_SALDO', 'E2_SALDO', 'E1_VALOR', 'E2_VALOR', 'VALOR_SALDO', 'SALDO_ABERTO'
  ],
  cashFlowType: [
    'TIPO_MOVIMENTO', 'TIPO_MOV', 'TIPO', 'NATUREZA', 'MOVIMENTO'
  ]
};

/**
 * Normaliza e formata valores de datas do Protheus garantindo ordenação cronológica estrita.
 */
export function normalizeDateValue(rawDate) {
  if (!rawDate) return { timestamp: 0, label: '', fullLabel: '', iso: '' };
  const s = String(rawDate).trim();

  // YYYYMMDD (Padrão Protheus Oracle/TOTVS Cloud)
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const ts = new Date(`${y}-${m}-${d}T00:00:00`).getTime();
    return {
      timestamp: isNaN(ts) ? 0 : ts,
      label: `${d}/${m}/${y.slice(2, 4)}`, // DD/MM/AA
      fullLabel: `${d}/${m}/${y}`,        // DD/MM/AAAA
      iso: `${y}-${m}-${d}`,
    };
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(5, 7);
    const d = s.slice(8, 10);
    const ts = new Date(`${y}-${m}-${d}T00:00:00`).getTime();
    return {
      timestamp: isNaN(ts) ? 0 : ts,
      label: `${d}/${m}/${y.slice(2, 4)}`,
      fullLabel: `${d}/${m}/${y}`,
      iso: `${y}-${m}-${d}`,
    };
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const parts = s.split('/');
    const d = parts[0];
    const m = parts[1];
    const y = parts[2];
    const ts = new Date(`${y}-${m}-${d}T00:00:00`).getTime();
    return {
      timestamp: isNaN(ts) ? 0 : ts,
      label: `${d}/${m}/${y.slice(2, 4)}`,
      fullLabel: `${d}/${m}/${y}`,
      iso: `${y}-${m}-${d}`,
    };
  }

  const ts = Date.parse(s);
  return {
    timestamp: isNaN(ts) ? 0 : ts,
    label: s,
    fullLabel: s,
    iso: s,
  };
}

/**
 * Avalia amostra de valores de uma coluna para verificar se são nomes/textos reais
 * ou se são códigos/identificadores numéricos/alfanuméricos curtos.
 */
export function isLikelyTextName(values) {
  if (!values || values.length === 0) return false;
  let textCount = 0;
  let codeCount = 0;
  values.forEach(v => {
    const s = String(v).trim();
    if (!s) return;
    if (/^\d+$/.test(s) || (s.length <= 6 && /^[0-9A-Z]+$/.test(s) && !/[a-zA-Z]{4,}/.test(s))) {
      codeCount++;
    } else if (/[a-zA-ZÀ-ÿ]{3,}/.test(s)) {
      textCount++;
    }
  });
  return textCount > codeCount;
}


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
  return (sampleValues || []).some(v => typeof v === 'string' && /^0\d+$/.test(v.trim()));
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
    const hasMeasureKeyword = (SEMANTIC_PATTERNS.measure || []).some(p => colUpper.includes(p));

    // Data só é válida se tiver formato ou padrão de data e NÃO for identificador
    // OU se o nome da coluna indica dimensão temporal (MES_FATURAMENTO, ANO, PERIODO, etc.)
    const timeDimInfo = inferTimeDimensionType(col);
    const isDate = !isIdCol && (
      dateCount / (values.length || 1) > 0.6 ||
      ((SEMANTIC_PATTERNS.date || []).some(p => colUpper.includes(p)) && !hasLeadingZeros) ||
      timeDimInfo.isTemporalDimension  // detecta MES_FATURAMENTO, ANO, PERIODO mesmo sem formato de data
    );


    // Dimensão semântica (cliente, fornecedor, vendedor, produto, filial, etc.)
    const isSemanticDimension = (SEMANTIC_PATTERNS.customer || []).some(p => colUpper.includes(p)) ||
                                (SEMANTIC_PATTERNS.supplier || []).some(p => colUpper.includes(p)) ||
                                (SEMANTIC_PATTERNS.seller || []).some(p => colUpper.includes(p)) ||
                                (SEMANTIC_PATTERNS.product || []).some(p => colUpper.includes(p)) ||
                                (SEMANTIC_PATTERNS.branch || []).some(p => colUpper.includes(p)) ||
                                (SEMANTIC_PATTERNS.geographic || []).some(p => colUpper.includes(p));

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
      sampleValues: values,
      timeDimInfo: timeDimInfo.isTemporalDimension ? timeDimInfo : undefined,
    };
  });

  // Detectar semântica com priorização estrita de colunas de NOME sobre CÓDIGO
  const semantics = {};
  const semanticCategories = ['customer', 'supplier', 'seller', 'product', 'branch', 'date', 'geographic', 'measure', 'cashFlowType'];

  for (const semKey of semanticCategories) {
    const namePatterns = SEMANTIC_NAME_PATTERNS[semKey];
    const codePatterns = SEMANTIC_CODE_PATTERNS[semKey] || SEMANTIC_PATTERNS[semKey] || [];

    if (namePatterns) {
      const ambNames = SEMANTIC_EXACT_ALIASES[semKey] || [];
      const otherEntityAliases = Object.entries(SEMANTIC_EXACT_ALIASES)
        .filter(([k]) => k !== semKey)
        .flatMap(([, v]) => v);

      // 1. Procura primeiro coluna com nome/descrição da entidade (ex: E1_NOMCLI, A1_NOME, NOME_CLIENTE, SA3.A3_NOME, B1_DESC, PRODUTO)
      const matchedNameCol = columnProfiles.find(c => {
        const upper = c.name.toUpperCase();
        if (otherEntityAliases.includes(upper)) {
          return false;
        }
        if (ambNames.includes(upper)) {
          return isLikelyTextName(c.sampleValues);
        }
        return namePatterns.some(p => upper === p || upper.startsWith(`${p}_`) || upper.endsWith(`_${p}`) || upper.includes(`_${p}_`));
      });
      // 2. Procura coluna com código/ID da entidade
      const matchedCodeCol = columnProfiles.find(c => {
        const upper = c.name.toUpperCase();
        if (otherEntityAliases.includes(upper)) {
          return false;
        }
        if (ambNames.includes(upper)) {
          return !isLikelyTextName(c.sampleValues);
        }
        return codePatterns.some(p => upper === p || upper.startsWith(`${p}_`) || upper.endsWith(`_${p}`) || upper.includes(`_${p}_`));
      });

      if (matchedNameCol) {
        semantics[semKey] = matchedNameCol.name;
        semantics[`${semKey}Name`] = matchedNameCol.name;
      } else if (matchedCodeCol) {
        semantics[semKey] = matchedCodeCol.name;
      }
      if (matchedCodeCol) {
        semantics[`${semKey}Code`] = matchedCodeCol.name;
      }
    } else {
      // Padrões sem distinção nome/código (branch, date, geographic, measure, cashFlowType)
      const matchedCol = columnProfiles.find(c => {
        const upper = c.name.toUpperCase();
        return codePatterns.some(p => upper === p || upper.includes(p));
      });
      if (matchedCol) {
        semantics[semKey] = matchedCol.name;
      }
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
    hasSupplier: !!semantics.supplier,
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
export function classifyDataset(schema, context = {}) {
  const prompt = String(context.originPrompt || context.prompt || '').toLowerCase();
  const isOverdue = /vencid|atras|inadimpl/i.test(prompt);
  const cols = Array.isArray(schema?.columns) ? schema.columns : [];
  const isReceivable = /receb|e1_/i.test(prompt) || cols.some(c => (String(c?.name || c || '')).toUpperCase().startsWith('E1_'));
  const isPayable = /pagar|pagam|e2_/i.test(prompt) || cols.some(c => (String(c?.name || c || '')).toUpperCase().startsWith('E2_'));

  // Classificações financeiras especializadas
  if (isOverdue && isReceivable) {
    return { datasetType: 'overdue_receivables', confidence: 0.95 };
  }
  if (isReceivable && !isPayable && (schema?.hasCustomer || schema?.hasDate)) {
    return { datasetType: 'accounts_receivable', confidence: 0.92 };
  }
  if (isPayable && !isReceivable && (schema?.hasSupplier || schema?.hasDate)) {
    return { datasetType: 'accounts_payable', confidence: 0.92 };
  }

  const scores = {
    seller_ranking: 0,
    customer_ranking: 0,
    supplier_ranking: 0,
    product_analysis: 0,
    geographic_distribution: 0,
    composition: 0,
    time_series: 0,
  };

  // Se houver data REAL com mais de 1 data distinta (série temporal real), pontua time_series
  const dateColProfile = cols.find(c => c?.type === 'date');
  const hasMultipleDates = schema?.hasDate && (dateColProfile?.distinct > 1);

  if (hasMultipleDates) {
    scores.time_series += 80;
  }
  
  // Entidades com pesos consistentes
  if (schema?.hasSeller) scores.seller_ranking += 90;
  if (schema?.hasCustomer) scores.customer_ranking += 90;
  if (schema?.hasSupplier) scores.supplier_ranking += 90;
  if (schema?.hasProduct) scores.product_analysis += 90;
  if (schema?.hasGeographic) scores.geographic_distribution += 85;

  // Cardinalidade para composição
  const singleDim = cols.find(c => c?.type === 'dimension');
  if (singleDim && singleDim.distinct > 1 && singleDim.distinct <= 6 && !hasMultipleDates) {
    scores.composition += 70;
  }

  // Se houver data E entidade, time_series ganha bônus APENAS se houver múltiplas datas
  if (hasMultipleDates && (schema?.hasCustomer || schema?.hasSupplier || schema?.hasProduct || schema?.hasSeller)) {
    scores.time_series += 20;
  }

  // Se NÃO houver múltiplas datas distintas, zera time_series
  if (!hasMultipleDates) {
    scores.time_series = 0;
  }

  let bestType = 'product_analysis';
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  // Fallback seguro
  if (maxScore === 0) {
    bestType = hasMultipleDates ? 'time_series' : (schema.hasProduct ? 'product_analysis' : (schema.hasCustomer ? 'customer_ranking' : (schema.hasSupplier ? 'supplier_ranking' : 'seller_ranking')));
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
  const m = String(measure || 'medida').toUpperCase();
  if (m === 'VALOR_TOTAL' || m === 'VALOR' || m === 'TOTAL') return 'Faturamento';
  return String(measure || 'medida')
    .replace(/^(TOTAL_|VALOR_|SUM_|AVG_)/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function inferPresentationDomain(schema) {
  const cols = Array.isArray(schema?.columns) ? schema.columns : [];
  const columns = cols.map(column => String(column?.name || column || '').toUpperCase());
  const hasFinanceEvidence = columns.some(column =>
    /^(E1|E2|E5)(_|$)/.test(column) || /(RECEB|A_RECEBER|PAGAR|A_PAGAR|SALDO_FINANCEIRO)/.test(column)
  );
  const hasSalesEvidence = columns.some(column =>
    /^(F2|D2|C5|C6)(_|$)/.test(column) || /FATURAMENTO|VALOR_FATURADO|QTD_PEDIDOS|VALOR_TOTAL/.test(column)
  ) || schema?.hasSeller || schema?.hasProduct;

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
    const prompt = String(context.originPrompt || context.prompt || '').toLowerCase();
    const isOverdue = /vencid|atras|inadimpl/i.test(prompt);

    if (presentation.domain === 'finance' || presentation.intent === 'cash_flow' || presentation.intent === 'finance') {
      if (isOverdue) label = 'Total vencido em aberto';
      else if (/(RECEB|RECEIVER|A_RECEBER|E1_)/.test(upperMeasure)) label = 'Total a receber em aberto';
      else if (/(PAGAR|PAGAMENTO|A_PAGAR|E2_)/.test(upperMeasure)) label = 'Total a pagar em aberto';
      else if (upperMeasure.includes('SALDO')) label = isOverdue ? 'Total vencido em aberto' : 'Saldo em aberto';
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
  let maxRow = null;
  const values = [];

  rows.forEach(r => {
    const raw = r[measure];
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    if (!isNaN(n)) {
      total += n;
      values.push(n);
      if (n < min) min = n;
      if (n > max) {
        max = n;
        maxRow = r;
      }
    }
  });

  const count = values.length || 1;

  // 1. Identificar se existe coluna de Quantidade de Pedidos ou Documentos no resultado
  const orderCol = (schema.columns || []).find(c => {
    const u = c.name.toUpperCase();
    return /^(QTD_PEDIDOS|NUM_PEDIDOS|PEDIDOS|TOTAL_PEDIDOS|QTD_NOTAS|NOTAS|DOCS|COUNT_DOC|QTD_DOCS|QUANTIDADE_PEDIDOS)$/i.test(u) ||
           (u.includes('PEDID') && (u.includes('QTD') || u.includes('NUM') || u.includes('COUNT') || u.includes('TOTAL')));
  })?.name;

  const docCol = (schema.columns || []).find(c => {
    const u = c.name.toUpperCase();
    return /^(F2_DOC|C5_NUM|D2_PEDIDO|DOC|NUMERO|NUM_DOC)$/i.test(u) || u.endsWith('_DOC') || u.endsWith('_PEDIDO');
  })?.name;

  let totalOrders = 0;
  if (orderCol) {
    totalOrders = rows.reduce((acc, r) => {
      const val = r[orderCol];
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
  } else if (docCol) {
    const distinctDocs = new Set(rows.map(r => r[docCol]).filter(Boolean));
    totalOrders = distinctDocs.size;
  }

  // 2. Identificar a entidade da Maior Ocorrência (Produto, Vendedor, Cliente, Fornecedor, etc.)
  let entityDim = null;
  let entityType = null;

  if (schema.hasProduct && schema.semantics?.product) {
    entityDim = schema.semantics.product;
    entityType = 'product';
  } else if (schema.hasSeller && schema.semantics?.seller) {
    entityDim = schema.semantics.seller;
    entityType = 'seller';
  } else if (schema.hasCustomer && schema.semantics?.customer) {
    entityDim = schema.semantics.customer;
    entityType = 'customer';
  } else if (schema.hasSupplier && schema.semantics?.supplier) {
    entityDim = schema.semantics.supplier;
    entityType = 'supplier';
  } else if (schema.hasGeographic && schema.semantics?.geographic) {
    entityDim = schema.semantics.geographic;
    entityType = 'geographic';
  } else {
    entityDim = schema.dimensions?.[0];
  }

  const nameCol = entityType ? (schema.semantics?.[`${entityType}Name`] || entityDim) : entityDim;
  const codeCol = entityType ? schema.semantics?.[`${entityType}Code`] : null;

  let topEntityName = '';
  if (maxRow) {
    const rawName = String(maxRow[nameCol] || '').trim();
    const rawCode = codeCol ? String(maxRow[codeCol] || '').trim() : '';
    const hasExplicitName = entityType ? !!schema.semantics?.[`${entityType}Name`] : false;
    if (entityType === 'seller' && (!hasExplicitName || !isLikelyTextName([rawName]))) {
      const c = rawCode || rawName;
      topEntityName = c ? (c.toLowerCase().startsWith('vendedor') ? c : `Vendedor ${c}`) : '';
    } else if (entityType === 'customer' && (!hasExplicitName || !isLikelyTextName([rawName]))) {
      const c = rawCode || rawName;
      topEntityName = c ? (/^\d+$/.test(c) ? `Cliente ${c}` : c) : '';
    } else {
      topEntityName = rawName || rawCode;
    }
  }

  // Definição da rotulagem da Maior Ocorrência informando qual entidade gerou a ocorrência
  let maxLabel = 'Maior Ocorrência';
  let maxSubtitle = '';
  if (entityType === 'seller') {
    const shortCode = topEntityName.replace(/^Vendedor\s+/i, '');
    maxLabel = topEntityName ? (topEntityName.toLowerCase().startsWith('vendedor') ? `Maior Vendedor (${shortCode})` : `Maior Vendedor (${topEntityName})`) : 'Maior Vendedor';
    maxSubtitle = topEntityName ? (topEntityName.toLowerCase().startsWith('vendedor') ? topEntityName : `Vendedor: ${topEntityName}`) : '';
  } else if (entityType === 'customer') {
    maxLabel = topEntityName ? `Maior Cliente (${topEntityName})` : 'Maior Cliente';
    maxSubtitle = topEntityName ? `Cliente: ${topEntityName}` : '';
  } else if (entityType === 'supplier') {
    maxLabel = topEntityName ? `Maior Fornecedor (${topEntityName})` : 'Maior Fornecedor';
    maxSubtitle = topEntityName ? `Fornecedor: ${topEntityName}` : '';
  } else if (entityType === 'product') {
    maxLabel = topEntityName ? `Produto Líder (${topEntityName})` : 'Produto Líder';
    maxSubtitle = topEntityName ? `Produto: ${topEntityName}` : '';
  } else if (topEntityName) {
    // Verificar se a dimensão de fallback é temporal (MES_FATURAMENTO, ANO, etc.)
    const dimTimeDimInfo = entityDim ? inferTimeDimensionType(entityDim) : { isTemporalDimension: false };
    if (dimTimeDimInfo.isTemporalDimension) {
      const humanValue = humanizeDimensionValue(entityDim, topEntityName);
      const periodLabel = dimTimeDimInfo.granularity === 'year' ? 'Melhor Ano'
        : dimTimeDimInfo.granularity === 'month_year' ? 'Melhor Período'
        : 'Melhor Mês';
      maxLabel = humanValue ? `${periodLabel} (${humanValue})` : periodLabel;
      maxSubtitle = humanValue || topEntityName;
    } else {
      maxLabel = `Maior Ocorrência (${topEntityName})`;
      maxSubtitle = topEntityName;
    }
  }


  // 3. Montagem dos 4 KPIs com inteligência de domínio
  const isSalesContext = presentation.domain === 'sales' || schema.hasSeller || schema.hasProduct;

  let kpiAvg = null;
  let kpiCount = null;

  if (totalOrders > 0) {
    kpiAvg = {
      label: 'Ticket Médio',
      value: total / totalOrders,
      format: presentation.format,
      type: 'avg',
      subtitle: `Média de ${Math.round(totalOrders).toLocaleString('pt-BR')} pedidos`,
    };
    kpiCount = {
      label: 'Total de Pedidos',
      value: Math.round(totalOrders),
      format: 'number',
      type: 'count',
      subtitle: count > 1 ? (
        entityType === 'seller' ? `${count} vendedores ativos` :
        entityType === 'product' ? `${count} produtos movimentados` :
        entityType === 'customer' ? `${count} clientes atendidos` :
        entityType === 'supplier' ? `${count} fornecedores` :
        `${count} registros`
      ) : '',
    };
  } else if (isSalesContext) {
    const leaderShare = total > 0 && max > 0 ? (max / total) * 100 : 0;
    kpiAvg = {
      label: 'Participação do Líder',
      value: leaderShare,
      format: 'percent',
      type: 'percent',
      subtitle: topEntityName ? `Representatividade de ${topEntityName}` : 'Concentração no 1º lugar',
    };
    kpiCount = {
      label: entityType === 'seller' ? 'Vendedores Ativos' :
             entityType === 'customer' ? 'Clientes Ativos' :
             entityType === 'product' ? 'Produtos Movimentados' :
             entityType === 'supplier' ? 'Fornecedores Ativos' : 'Total de Registros',
      value: count,
      format: 'number',
      type: 'count',
    };
  } else {
    kpiAvg = {
      label: 'Média por Registro',
      value: total / count,
      format: presentation.format,
      type: 'avg',
    };
    kpiCount = {
      label: 'Total de Registros',
      value: count,
      format: 'number',
      type: 'count',
    };
  }

  const kpis = [
    {
      label: presentation.label,
      value: total,
      format: presentation.format,
      type: 'sum',
    },
    kpiAvg,
    {
      label: maxLabel,
      value: max === -Infinity ? 0 : max,
      format: presentation.format,
      type: 'max',
      subtitle: maxSubtitle,
      entity: topEntityName,
    },
    kpiCount,
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
    const dim = (schema.hasProduct && schema.semantics.product) ||
                (schema.hasSeller && schema.semantics.seller) ||
                (schema.hasCustomer && schema.semantics.customer) ||
                (schema.hasSupplier && schema.semantics.supplier) ||
                (schema.hasGeographic && schema.semantics.geographic) ||
                schema.dimensions[0];
    const dimLabel = (schema.hasProduct && schema.semantics.product === dim) ? 'produto' :
                     (schema.hasSeller && schema.semantics.seller === dim) ? 'vendedor' :
                     (schema.hasCustomer && schema.semantics.customer === dim) ? 'cliente' :
                     (schema.hasSupplier && schema.semantics.supplier === dim) ? 'fornecedor' :
                     (schema.hasGeographic && schema.semantics.geographic === dim) ? 'região' : 'registro';

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
  const dim = (schema.hasProduct && schema.semantics.product) ||
              (schema.hasSeller && schema.semantics.seller) ||
              (schema.hasCustomer && schema.semantics.customer) ||
              (schema.hasSupplier && schema.semantics.supplier) ||
              (schema.hasGeographic && schema.semantics.geographic) ||
              schema.dimensions[0];
  const insights = [];

  if (dim) {
    const entityKey = (schema.hasProduct && schema.semantics.product === dim) ? 'product' :
                      (schema.hasSeller && schema.semantics.seller === dim) ? 'seller' :
                      (schema.hasCustomer && schema.semantics.customer === dim) ? 'customer' :
                      (schema.hasSupplier && schema.semantics.supplier === dim) ? 'supplier' : null;
    const codeCol = entityKey ? schema.semantics[`${entityKey}Code`] : null;

    // Passo 1: Agregar por dimensão primeiro
    const aggMap = new Map();
    rows.forEach(r => {
      const rawName = String(r[dim] || '').trim();
      const rawCode = codeCol ? String(r[codeCol] || '').trim() : '';
      const hasExplicitName = entityKey ? !!schema.semantics?.[`${entityKey}Name`] : false;
      let displayName = rawName || rawCode || 'Outros';
      if (entityKey === 'seller' && (!hasExplicitName || !isLikelyTextName([displayName]))) {
        const c = rawCode || rawName;
        displayName = c ? (c.toLowerCase().startsWith('vendedor') ? c : `Vendedor ${c}`) : 'Outros';
      } else if (entityKey === 'customer' && (!hasExplicitName || !isLikelyTextName([displayName]))) {
        const c = rawCode || rawName;
        if (/^\d+$/.test(c)) {
          displayName = `Cliente ${c}`;
        }
      }
      const key = (rawName && rawCode) ? `${rawCode}___${rawName}` : displayName;

      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;

      const existing = aggMap.get(key);
      if (existing) {
        existing.val += val;
      } else {
        aggMap.set(key, { label: displayName, code: rawCode, val });
      }
    });

    // Passo 2: Denominador é a SOMA DOS MÓDULOS dos grupos — nunca o saldo líquido
    const absTotal = [...aggMap.values()].reduce((acc, v) => acc + Math.abs(v.val), 0);
    const sorted = [...aggMap.values()].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

    if (sorted.length > 0 && absTotal > 0) {
      const topItem = sorted[0];
      const share = (Math.abs(topItem.val) / absTotal) * 100;

      const dimLabel = entityKey === 'product' ? 'produto' :
                       entityKey === 'seller' ? 'vendedor' :
                       entityKey === 'customer' ? 'cliente' :
                       entityKey === 'supplier' ? 'fornecedor' :
                       (schema.hasGeographic && schema.semantics.geographic === dim) ? 'região' : 'registro';

      insights.push({
        title: 'Concentração Principal',
        description: `O principal ${dimLabel} (${topItem.label}) representa ${share.toFixed(1)}% do total movimentado.`,
        value: `${share.toFixed(1)}%`,
        type: share > 30 ? 'critical' : 'information',
      });

      if (sorted.length >= 3) {
        const top3AbsVal = sorted.slice(0, 3).reduce((acc, v) => acc + Math.abs(v.val), 0);
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

  // Se houver data: Gráfico de Linha / Tendência com ordenação cronológica estrita
  if (schema.hasDate) {
    const dateCol = schema.dateColumns[0];
    const dateColProfile = (schema.columns || []).find(c => c.name === dateCol);
    const isSemanticTemporal = !!dateColProfile?.timeDimInfo?.isTemporalDimension;
    const dateAgg = new Map();

    rows.forEach(r => {
      const rawDate = r[dateCol];
      if (rawDate === null || rawDate === undefined || rawDate === '') return;
      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;

      if (isSemanticTemporal) {
        // Dimensão temporal semântica (MES_FATURAMENTO='06', ANO='2025', PERIODO='202506')
        // Usamos o valor raw como chave de agrupamento e humanizamos o label
        const key = String(rawDate).trim();
        const humanLabel = humanizeDimensionValue(dateCol, key);
        const existing = dateAgg.get(key);
        if (existing) {
          existing.value += val;
        } else {
          // Timestamp para ordenação: para meses (01-12) ou anos (2025), converte para número
          const sortKey = parseInt(key.replace(/\D/g, ''), 10) || 0;
          dateAgg.set(key, { timestamp: sortKey, label: humanLabel, fullLabel: humanLabel, value: val });
        }
      } else {
        // Data real com formato YYYYMMDD, YYYY-MM-DD, etc.
        const normalized = normalizeDateValue(rawDate);
        if (!normalized.iso) return;
        const humanLabel = humanizeDimensionValue(dateCol, normalized.label) || normalized.label;
        const existing = dateAgg.get(normalized.iso);
        if (existing) {
          existing.value += val;
        } else {
          dateAgg.set(normalized.iso, {
            timestamp: normalized.timestamp,
            label: humanLabel,
            fullLabel: humanizeDimensionValue(dateCol, normalized.fullLabel) || normalized.fullLabel,
            value: val,
          });
        }
      }
    });

    const points = [...dateAgg.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(p => ({
        label: p.label,
        fullLabel: p.fullLabel,
        value: p.value,
      }));

    if (points.length > 1) {
      charts.push({
        chartType: 'line',
        title: 'Evolução Temporal',
        xAxisKey: 'label',
        dataKey: 'value',
        data: points,
      });
    }
  }


  // Gráficos por dimensão
  const dimCol = (schema.hasProduct && schema.semantics.product) ||
                 (schema.hasSeller && schema.semantics.seller) ||
                 (schema.hasCustomer && schema.semantics.customer) ||
                 (schema.hasSupplier && schema.semantics.supplier) ||
                 (schema.hasGeographic && schema.semantics.geographic) ||
                 schema.dimensions[0];
  if (dimCol) {
    const dimProfile = (schema.columns || []).find(c => c.name === dimCol);
    const distinctCount = dimProfile?.distinct || rows.length;

    const entityKey = (schema.hasProduct && schema.semantics.product === dimCol) ? 'product' :
                      (schema.hasSeller && schema.semantics.seller === dimCol) ? 'seller' :
                      (schema.hasCustomer && schema.semantics.customer === dimCol) ? 'customer' :
                      (schema.hasSupplier && schema.semantics.supplier === dimCol) ? 'supplier' : null;
    const codeCol = entityKey ? schema.semantics[`${entityKey}Code`] : null;

    const aggMap = new Map();
    rows.forEach(r => {
      const rawName = String(r[dimCol] || '').trim();
      const rawCode = codeCol ? String(r[codeCol] || '').trim() : '';
      const hasExplicitName = entityKey ? !!schema.semantics?.[`${entityKey}Name`] : false;
      let displayName = rawName || rawCode || 'Outros';
      if (entityKey === 'seller' && (!hasExplicitName || !isLikelyTextName([displayName]))) {
        const c = rawCode || rawName;
        displayName = c ? (c.toLowerCase().startsWith('vendedor') ? c : `Vendedor ${c}`) : 'Outros';
      } else if (entityKey === 'customer' && (!hasExplicitName || !isLikelyTextName([displayName]))) {
        const c = rawCode || rawName;
        if (/^\d+$/.test(c)) {
          displayName = `Cliente ${c}`;
        }
      }
      const key = (rawName && rawCode) ? `${rawCode}___${rawName}` : displayName;

      const raw = r[measure];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')) || 0;

      const existing = aggMap.get(key);
      if (existing) {
        existing.value += val;
      } else {
        aggMap.set(key, {
          label: displayName,
          name: displayName,
          code: rawCode,
          value: val,
        });
      }
    });

    const sortedPoints = [...aggMap.values()]
      .sort((a, b) => b.value - a.value)
      .map(p => ({ label: p.label, name: p.label, code: p.code, value: p.value }));

    const dimLabel = entityKey === 'product' ? 'Produto' :
                     entityKey === 'seller' ? 'Vendedor' :
                     entityKey === 'customer' ? 'Cliente' :
                     entityKey === 'supplier' ? 'Fornecedor' :
                     (schema.hasGeographic && schema.semantics.geographic === dimCol) ? 'Região' :
                     humanizeColumnName(dimCol); // humaniza nomes técnicos: MES_FATURAMENTO → Mês

    // Regra da Cardinalidade:
    // Poucos valores (<= 6) -> Donut / Pizza / Composição
    // Muitos valores (> 6) -> Top 10 Bar Chart
    if (distinctCount <= 6 && charts.length === 0) {
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

      // Se não há gráfico de linha temporal e temos mais de 5 itens, inclui gráfico Donut complementar
      if (charts.length === 1 && sortedPoints.length > 5) {
        const top5 = sortedPoints.slice(0, 5).map(p => ({ ...p, name: p.label }));
        const othersVal = sortedPoints.slice(5).reduce((acc, p) => acc + p.value, 0);
        if (othersVal > 0) {
          top5.push({
            label: 'Outros',
            name: 'Outros',
            value: othersVal,
          });
        }
        charts.push({
          chartType: 'donut',
          title: `Participação Top 5 ${dimLabel}s vs Outros`,
          data: top5,
          dataKey: 'value',
          nameKey: 'name',
        });
      }
    }
  }

  return charts;
}

// ─── 6. Motor de Sugestões Automáticas Contextuais ────────────────────────────
export function generateContextualSuggestions(schema, data = {}) {
  const suggestions = [];
  const charts = data.charts || [];
  // Procura gráfico de dimensão (bar ou donut) para extrair o líder real da entidade, evitando data temporal
  const dimChart = charts.find(c => c.chartType === 'bar' || c.chartType === 'donut');
  const topItem = dimChart?.data?.[0]?.label || dimChart?.data?.[0]?.name;

  if (schema.hasProduct) {
    suggestions.push('Curva ABC completa de produtos');
    suggestions.push('Produtos com maior volume');
    suggestions.push('Vendas por linha de produto');
    if (topItem) {
      suggestions.push(`Clientes que compram o produto ${topItem}`);
    }
  } else if (schema.hasSeller) {
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
export function detectCashFlow(schema, rows, semanticContext = {}) {
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
    const cols = Array.isArray(schema?.columns) ? schema.columns : [];
    const typeCols = cols.filter(c => {
      const upper = (String(c?.name || c || '')).toUpperCase();
      return (SEMANTIC_PATTERNS.cashFlowType || []).some(p => upper === p || upper.includes(p));
    });
    if (typeCols.length > 0) typeCol = typeCols[0].name || typeCols[0];
  }

  if (!typeCol) return null;

  // Coluna de valor/medida
  let measure = schema?.primaryMeasure;
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
  let dateCol = schema?.dateColumns?.[0] || null;
  if (!dateCol) {
    for (const k of Object.keys(rows[0] || {})) {
      const upper = k.toUpperCase();
      if ((SEMANTIC_PATTERNS.date || []).some(p => upper.includes(p)) || isDateColumn(k, rows)) {
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
      const norm = normalizeDateValue(rawDate);
      const dateKey = norm.label || 'Geral';
      if (!byDate[dateKey]) byDate[dateKey] = { rawDate, timestamp: norm.timestamp, fullLabel: norm.fullLabel, RECEBIMENTO: 0, PAGAMENTO: 0 };
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

  // REGRA CRÍTICA: Só é Fluxo de Caixa se houver TANTO recebimentos QUANTO pagamentos (> 0),
  // OU se a pergunta explicitamente solicitar fluxo de caixa.
  const prompt = String(semanticContext?.originPrompt || semanticContext?.prompt || '').toLowerCase();
  const isExplicitCashFlow = /fluxo\s+de\s+caixa|proje[cç][aã]o\s+de\s+caixa|entradas?\s+e\s+sa[ií]das?|pagar\s+e\s+receber|receber\s+e\s+pagar/i.test(prompt);
  const hasBothMovements = totalReceber > 0 && totalPagar > 0;

  if (!hasBothMovements && !isExplicitCashFlow) {
    // Se tiver apenas RECEBIMENTO (sem pagamentos) e a pergunta não for de fluxo de caixa,
    // trata-se de Contas a Receber / Inadimplência normal, NÃO de fluxo de caixa!
    return null;
  }

  const saldoProjetado = totalReceber - totalPagar;


  // Série temporal por data (para gráfico de barras agrupadas e linha de diferença)
  const dailySeries = Object.entries(byDate)
    .sort(([, a], [, b]) => (a.timestamp || 0) - (b.timestamp || 0))
    .map(([date, vals]) => ({
      date,
      RECEBIMENTO: vals.RECEBIMENTO,
      PAGAMENTO: vals.PAGAMENTO,
      SALDO: vals.RECEBIMENTO - vals.PAGAMENTO,
      label: date,
      fullLabel: vals.fullLabel || date,
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
  const norm = normalizeDateValue(dateStr);
  return norm.label || dateStr;
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
    const fmt = v => (typeof v === 'number' ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const statusSaldo = saldoProjetado >= 0 ? '✓ (Superávit projetado)' : '⚠ (Déficit projetado)';
    const parts = ['**Resumo do Fluxo de Caixa (Próximos Dias):**\n'];
    parts.push(`• **Total em Aberto a Receber:** R$ ${fmt(totalReceber)}`);
    parts.push(`• **Total em Aberto a Pagar:** R$ ${fmt(totalPagar)}`);
    parts.push(`• **Saldo Projetado (Diferença):** R$ ${fmt(saldoProjetado)} ${statusSaldo}`);
    parts.push(`• **Títulos em Aberto:** ${count} registros analisados`);
    return parts.join('\n');
  }



  // Se for títulos vencidos a receber
  if (context.screenType === 'overdue_receivables') {
    const totalKpi = data.kpis?.find(k => k.type === 'sum');
    const fmtTotal = totalKpi ? `R$ ${totalKpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00';
    const leaderBar = data.charts?.find(c => c.chartType === 'bar' || c.chartType === 'donut');
    const leaderItem = leaderBar?.data?.[0];
    const parts = ['**Resumo dos Títulos Vencidos a Receber (Inadimplência):**\n'];
    parts.push(`• **Total Vencido em Aberto:** ${fmtTotal}`);
    if (leaderItem) {
      const leaderVal = typeof leaderItem.value === 'number'
        ? `R$ ${leaderItem.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : leaderItem.value;
      parts.push(`• **Maior Título / Devedor:** ${leaderItem.label} (${leaderVal})`);
    }
    parts.push(`• **Volume:** ${count} títulos vencidos analisados`);
    return parts.join('\n');
  }

  // Se for contas a receber em aberto
  if (context.screenType === 'accounts_receivable') {
    const totalKpi = data.kpis?.find(k => k.type === 'sum');
    const fmtTotal = totalKpi ? `R$ ${totalKpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00';
    const leaderBar = data.charts?.find(c => c.chartType === 'bar' || c.chartType === 'donut');
    const leaderItem = leaderBar?.data?.[0];
    const parts = ['**Resumo de Contas a Receber em Aberto:**\n'];
    parts.push(`• **Total em Aberto a Receber:** ${fmtTotal}`);
    if (leaderItem) {
      const leaderVal = typeof leaderItem.value === 'number'
        ? `R$ ${leaderItem.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : leaderItem.value;
      parts.push(`• **Cliente Líder:** ${leaderItem.label} (${leaderVal})`);
    }
    parts.push(`• **Volume:** ${count} títulos analisados`);
    return parts.join('\n');
  }

  const totalKpi = data.kpis?.find(k => k.type === 'sum');

  // Identifica o líder a partir do primeiro gráfico ou dos dados agrupados
  const barChart = data.charts?.find(c => c.chartType === 'bar' || c.chartType === 'donut');
  const leaderItem = barChart?.data?.[0];
  const leaderLabel = leaderItem?.label || leaderItem?.name;
  const leaderValue = leaderItem?.value;
  const presentation = resolveMeasurePresentation(schema, context);

  const entitySingular = schema.hasProduct ? 'Produto líder' :
                         schema.hasSeller ? 'Vendedor líder' :
                         schema.hasCustomer ? 'Cliente líder' :
                         schema.hasSupplier ? 'Fornecedor líder' :
                         schema.hasGeographic ? 'Região líder' :
                         schema.dimensions?.length ? 'Dimensão de maior valor' : 'Maior ocorrência';

  const entityPlural = schema.hasProduct ? 'produtos' :
                       schema.hasSeller ? 'vendedores' :
                       schema.hasCustomer ? 'clientes' :
                       schema.hasSupplier ? 'fornecedores' :
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
export function buildAdaptiveDashboard(rows, columns = [], semanticContext = {}, backendKpis = null, backendInsights = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  // Integração com dicionário semântico Protheus/SX3 caso fornecido
  if (semanticContext.columnLabels) {
    setGlobalSemanticLabels(semanticContext.columnLabels);
  }

  const schema = analyzeSchema(rows, columns);
  const presentation = resolveMeasurePresentation(schema, semanticContext);

  // Detecta padrão de Fluxo de Caixa antes de qualquer classificação genérica
  const cashFlowData = detectCashFlow(schema, rows, semanticContext);

  let kpis, insights, charts, screenType, confidence;

  if (cashFlowData) {
    // Caminho especializado: Fluxo de Caixa
    kpis = buildCashFlowKPIs(cashFlowData);
    kpis[3] = { ...kpis[3], value: rows.length };
    insights = buildCashFlowInsights(cashFlowData);
    charts = buildCashFlowCharts(cashFlowData);
    screenType = 'cash_flow';
    confidence = 0.99;
  } else {
    // Caminho genérico com classificações especializadas
    const classification = classifyDataset(schema, semanticContext);
    screenType = classification.datasetType;
    confidence = classification.confidence;

    // Se for Inadimplência / Títulos Vencidos, utiliza a fábrica especializada
    if (screenType === 'overdue_receivables') {
      const entityCol = (schema.hasCustomer && schema.semantics.customer) || schema.dimensions?.[0] || columns[0];
      const recDashboard = buildReceivablesDashboard({
        schema,
        rows,
        measure: schema.primaryMeasure,
        entityCol,
        entityType: 'customer',
        backendKpis,
        backendInsights,
      });
      kpis = recDashboard.kpis;
      charts = recDashboard.charts;
      insights = buildInsights(schema, rows, backendKpis);
    } else if (screenType === 'time_series' && backendKpis?.trend) {
      const tsDashboard = buildTimeSeriesDashboard({
        schema,
        rows,
        measure: schema.primaryMeasure,
        dateCol: schema.dateColumns?.[0] || 'DATA',
        backendKpis,
        backendInsights,
      });
      kpis = tsDashboard.kpis;
      charts = buildCharts(schema, rows);
      insights = buildInsights(schema, rows, backendKpis);
    } else {
      kpis = buildKPIs(schema, rows, semanticContext);
      insights = buildInsights(schema, rows, backendKpis);
      charts = buildCharts(schema, rows);
    }
  }

  const contextData = {
    rows,
    columns: columns.length > 0 ? columns : Object.keys(rows[0] || {}),
    kpis,
    insights,
    charts,
    backendKpis,
    backendInsights,
    cashFlowData,
    series: charts.filter(c => c.chartType === 'bar' || c.chartType === 'line' || c.chartType === 'grouped_bar').map(c => ({
      label: c.title,
      points: c.data,
    })),
  };

  let suggestions;
  if (cashFlowData) {
    suggestions = [
      'Fluxo de caixa dos próximos 15 dias',
      'Títulos vencidos a receber',
      'Clientes com maior volume a pagar',
      'Comparar com semana anterior',
    ];
  } else if (screenType === 'overdue_receivables') {
    suggestions = [
      'Mostrar títulos com mais de 60 dias de atraso',
      'Extrato detalhado do maior devedor',
      'Projeção de recebimentos das próximas semanas',
      'Comparar evolução da inadimplência por mês',
    ];
  } else if (screenType === 'time_series') {
    suggestions = [
      'Comparar vendas com o mês anterior',
      'Identificar líderes de crescimento no período',
      'Exibir curva ABC dos itens comercializados',
      'Projetar tendência para o próximo mês',
    ];
  } else {
    suggestions = generateContextualSuggestions(schema, contextData);
  }

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

  // Narrativa executiva gerada pelo Presentation Intelligence Engine
  analysisContext.executiveSummary = buildExecutiveNarrative(analysisContext);

  return analysisContext;
}

/**
 * Dashboard Factory — Copilot Protheus Analytics 2.0
 * 
 * Responsável pela montagem inteligente de KPIs, Gráficos e Sugestões contextuais
 * orientados por dados e domínio de negócio (Recebíveis, Vendas, Fluxo de Caixa, Estoque, etc.).
 */

import { humanizeColumnName, humanizeDimensionValue, formatExecutiveValue } from './presentationIntelligence.js';

/**
 * Cria dashboard específico para Inadimplência e Contas a Receber Vencidas.
 */
export function buildReceivablesDashboard({ schema, rows, measure, entityCol, entityType, backendKpis, backendInsights }) {
  const total = backendKpis?.total || rows.reduce((acc, r) => acc + (parseFloat(String(r[measure] || 0).replace(',', '.')) || 0), 0);
  const count = rows.length;

  // Se houver coluna com o nome do cliente/devedor, preferir sobre códigos de cliente
  const nameCol = schema?.semantics?.customerName 
    || schema?.columns?.find(c => /NOMCLI|A1_NOME|NOME_CLIENTE|RAZAO|CLIENTE_NOME/i.test(c.name || c))?.name
    || entityCol;
  const effectiveEntityCol = nameCol || entityCol;

  // Gráfico 1: Top Devedores calculados por agregação
  const aggMap = new Map();
  rows.forEach(r => {
    const rawName = String(r[effectiveEntityCol] || r[entityCol] || '').trim();
    if (!rawName) return;
    const val = parseFloat(String(r[measure] || 0).replace(',', '.')) || 0;
    aggMap.set(rawName, (aggMap.get(rawName) || 0) + val);
  });

  const sortedDevedores = [...aggMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, val]) => ({
      label: humanizeDimensionValue(effectiveEntityCol, name),
      name: humanizeDimensionValue(effectiveEntityCol, name),
      value: val,
    }));

  const distinctEntities = aggMap.size || backendKpis?.distinct_entities || count;

  // O líder do gráfico é o Top 1 do KPI — garantia de 100% de coerência entre Card e Gráfico!
  const leaderDevedor = sortedDevedores[0] || null;
  const top1Name = leaderDevedor?.name || (backendKpis?.maior_ocorrencia_nome ? humanizeDimensionValue(effectiveEntityCol, backendKpis.maior_ocorrencia_nome) : '');
  const top1Val = leaderDevedor ? leaderDevedor.value : (backendKpis?.maior_ocorrencia_valor || 0);
  const top1Share = total > 0 ? (top1Val / total) * 100 : (backendKpis?.concentration || 0);

  // 1. KPIs Específicos de Recebíveis
  const kpis = [
    {
      label: 'Saldo Vencido Total',
      value: total,
      format: 'currency',
      type: 'receber',
      subtitle: `${count} títulos em aberto`,
    },
    {
      label: 'Clientes Inadimplentes',
      value: distinctEntities,
      format: 'number',
      type: 'count',
      subtitle: 'Com títulos vencidos',
    },
    {
      label: top1Name ? `Maior Devedor (${top1Name})` : 'Maior Devedor',
      value: top1Val,
      format: 'currency',
      type: 'pagar',
      subtitle: `${top1Share.toFixed(1)}% do saldo total`,
    },
  ];

  // 4º KPI: Prioriza Aging acima de 60 dias se disponível, senão Ticket Médio
  const aging = backendKpis?.aging;
  if (aging && aging.total_overdue > 0) {
    kpis.push({
      label: 'Atraso Crítico (> 60 dias)',
      value: (aging['61_90']?.total || 0) + (aging['90_plus']?.total || 0),
      format: 'currency',
      type: 'pagar',
      subtitle: `${aging.pct_above_60?.toFixed(1) || 0}% do valor vencido`,
    });
  } else {
    kpis.push({
      label: 'Ticket Médio por Título',
      value: count > 0 ? total / count : 0,
      format: 'currency',
      type: 'avg',
      subtitle: 'Média por documento',
    });
  }

  // 2. Gráficos Específicos de Recebíveis
  const charts = [];

  if (sortedDevedores.length > 0) {
    charts.push({
      chartType: 'bar',
      title: 'Top 10 Maiores Devedores',
      xAxisKey: 'label',
      dataKey: 'value',
      color: '#ef4444', // Vermelho para risco/inadimplência
      data: sortedDevedores,
    });
  }

  // Gráfico 2: Aging / Faixas de Atraso (se houver dados calculados)
  if (aging && aging.total_overdue > 0) {
    const agingData = [
      { label: '0 a 15 dias', value: aging['0_15']?.total || 0, count: aging['0_15']?.count || 0 },
      { label: '16 a 30 dias', value: aging['16_30']?.total || 0, count: aging['16_30']?.count || 0 },
      { label: '31 a 60 dias', value: aging['31_60']?.total || 0, count: aging['31_60']?.count || 0 },
      { label: '61 a 90 dias', value: aging['61_90']?.total || 0, count: aging['61_90']?.count || 0 },
      { label: 'Acima de 90 dias', value: aging['90_plus']?.total || 0, count: aging['90_plus']?.count || 0 },
    ].filter(b => b.value > 0);

    if (agingData.length > 0) {
      charts.push({
        chartType: 'bar',
        title: 'Distribuição por Faixa de Atraso (Aging)',
        xAxisKey: 'label',
        dataKey: 'value',
        color: '#f97316', // Laranja
        data: agingData,
      });
    }
  }

  // Gráfico 3: Concentração (Donut dos maiores)
  if (sortedDevedores.length > 1) {
    const top5 = sortedDevedores.slice(0, 5);
    const top5Sum = top5.reduce((s, i) => s + i.value, 0);
    const outros = Math.max(0, total - top5Sum);
    const donutData = [...top5];
    if (outros > 0) {
      donutData.push({ label: 'Demais Clientes', name: 'Demais Clientes', value: outros });
    }
    charts.push({
      chartType: 'donut',
      title: 'Concentração da Inadimplência',
      dataKey: 'value',
      nameKey: 'label',
      data: donutData,
    });
  }

  // 3. Sugestões Contextuais de Negócio
  const suggestions = [
    'Mostrar títulos com mais de 60 dias de atraso',
    top1Name ? `Extrato detalhado de títulos do cliente ${top1Name}` : 'Extrato detalhado de títulos do maior devedor',
    'Projeção de recebimentos das próximas semanas',
    'Comparar evolução da inadimplência por mês',
  ];

  return {
    screenType: 'overdue_receivables',
    title: 'Painel de Inadimplência & Títulos Vencidos',
    badge: 'Inadimplência',
    description: 'Análise de exposição financeira, concentração de dívidas e faixas de atraso dos títulos em aberto.',
    kpis,
    charts,
    suggestions,
  };
}

/**
 * Cria dashboard específico para Séries Temporais e Evolução de Vendas/Receitas.
 */
export function buildTimeSeriesDashboard({ schema, rows, measure, dateCol, backendKpis, backendInsights }) {
  const total = backendKpis?.total || rows.reduce((acc, r) => acc + (parseFloat(String(r[measure] || 0).replace(',', '.')) || 0), 0);
  const trend = backendKpis?.trend;
  const bestPeriod = trend?.best_period;

  const kpis = [
    {
      label: 'Faturamento Acumulado',
      value: total,
      format: 'currency',
      type: 'sum',
      subtitle: `${rows.length} registros no período`,
    },
  ];

  if (bestPeriod && bestPeriod.label) {
    const humanBest = humanizeDimensionValue(dateCol, bestPeriod.label);
    kpis.push({
      label: `Melhor Período (${humanBest})`,
      value: bestPeriod.value,
      format: 'currency',
      type: 'max',
      subtitle: `${bestPeriod.share_pct?.toFixed(1) || 0}% do total`,
    });
  } else {
    kpis.push({
      label: 'Média por Período',
      value: rows.length > 0 ? total / rows.length : 0,
      format: 'currency',
      type: 'avg',
      subtitle: 'Média cronológica',
    });
  }

  if (backendKpis?.top3_share) {
    kpis.push({
      label: 'Top 3 Períodos Representam',
      value: backendKpis.top3_share,
      format: 'percent',
      type: 'percent',
      subtitle: 'Concentração dos 3 maiores',
    });
  } else {
    kpis.push({
      label: 'Total de Períodos',
      value: rows.length,
      format: 'number',
      type: 'count',
      subtitle: 'Ciclos analisados',
    });
  }

  if (trend) {
    const sign = trend.growth_pct > 0 ? '+' : '';
    kpis.push({
      label: 'Tendência do Período',
      value: trend.growth_pct,
      format: 'percent',
      type: trend.direction === 'crescimento' ? 'avg' : 'saldo',
      subtitle: `${sign}${trend.growth_pct.toFixed(1)}% vs início da série`,
    });
  } else {
    kpis.push({
      label: 'Concentração do Líder',
      value: backendKpis?.concentration || 0,
      format: 'percent',
      type: 'percent',
      subtitle: 'Participação máxima',
    });
  }

  const suggestions = [
    'Comparar vendas com o mês anterior',
    'Identificar vendedores com maior crescimento no período',
    'Exibir curva ABC de produtos vendidos',
    'Projetar tendência para os próximos períodos',
  ];

  return {
    screenType: 'time_series',
    title: 'Evolução Temporal & Tendência de Vendas',
    badge: 'Série Temporal',
    description: 'Acompanhamento cronológico do faturamento com identificação de picos e taxas de crescimento.',
    kpis,
    suggestions,
  };
}

/**
 * Cria dashboard específico para Estoque e Suprimentos.
 */
export function buildInventoryDashboard({ schema, rows, measure, entityCol, backendKpis }) {
  const total = backendKpis?.total || rows.reduce((acc, r) => acc + (parseFloat(String(r[measure] || 0).replace(',', '.')) || 0), 0);
  const count = rows.length;

  const kpis = [
    {
      label: 'Itens em Estoque',
      value: count,
      format: 'number',
      type: 'count',
      subtitle: 'Produtos monitorados',
    },
    {
      label: 'Saldo Financeiro em Estoque',
      value: total,
      format: 'currency',
      type: 'sum',
      subtitle: 'Posição patrimonial',
    },
    {
      label: backendKpis?.maior_ocorrencia_nome ? `Item de Maior Saldo (${backendKpis.maior_ocorrencia_nome})` : 'Item Líder em Estoque',
      value: backendKpis?.maior_ocorrencia_valor || 0,
      format: 'currency',
      type: 'max',
      subtitle: `${backendKpis?.concentration?.toFixed(1) || 0}% do valor total`,
    },
    {
      label: 'Itens Críticos (Curva A)',
      value: backendKpis?.abc_curve?.a_count || Math.ceil(count * 0.2),
      format: 'number',
      type: 'percent',
      subtitle: '80% do valor estocado',
    },
  ];

  const suggestions = [
    'Listar produtos com estoque abaixo do ponto de pedido',
    'Exibir itens sem movimentação há mais de 60 dias',
    'Ver curva ABC completa de produtos',
    'Previsão de ruptura de estoque dos itens da Curva A',
  ];

  return {
    screenType: 'product_analysis',
    title: 'Posição e Giro de Estoque',
    badge: 'Estoque',
    description: 'Visão consolidada de saldos, itens críticos e representatividade por produto.',
    kpis,
    suggestions,
  };
}

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { BarChartCard } from '../charts/BarChartCard';
import { LineChartCard } from '../charts/LineChartCard';
import { DonutChartCard } from '../charts/DonutChartCard';
import { DataGrid } from '../ui/DataGrid';
import { MetricCard } from '../kpis/MetricCard';
import { InsightCard } from '../insights/InsightCard';
import { 
  DollarSign, Users, ShoppingCart, Percent, TrendingUp, Award, BarChart3, Package,
  Sparkles, ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Bookmark, BookmarkCheck,
  Lightbulb, AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, X, ChevronRight
} from 'lucide-react';

import { humanizeColumnName } from '../../services/presentationIntelligence';
import { formatDateBR } from '../../utils/formatDate';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { ExecutiveModeToggle } from './ExecutiveModeToggle';
import { buildAdaptiveDashboard } from '../../services/adaptiveDashboardEngine';

const SCREEN_CONFIGS = {
  time_series: {
    title: 'Análise Temporal & Evolução',
    badge: 'Série Temporal',
    description: 'Tendência cronológica e evolução de valores e movimentações.',
  },
  ranking: {
    title: 'Ranking & Concentração',
    badge: 'Ranking',
    description: 'Classificação por representatividade e análise de concentração de clientes/entidades.',
  },
  customer_ranking: {
    title: 'Ranking de Clientes & Concentração',
    badge: 'Clientes',
    description: 'Classificação por faturamento e representatividade de clientes na carteira.',
  },
  seller_ranking: {
    title: 'Ranking de Vendedores & Performance Comercial',
    badge: 'Comercial',
    description: 'Volume faturado e atingimento por vendedor/representante.',
  },
  supplier_ranking: {
    title: 'Ranking de Fornecedores & Compras',
    badge: 'Fornecedores',
    description: 'Volume de compras e representatividade por fornecedor.',
  },
  product_analysis: {
    title: 'Performance de Produtos & Itens',
    badge: 'Produtos',
    description: 'Volume, faturamento e dispersão por item ou linha de produtos.',
  },
  geographic: {
    title: 'Distribuição Regional',
    badge: 'Geográfico',
    description: 'Dispersão de receitas e faturamento por estado/região.',
  },
  geographic_distribution: {
    title: 'Distribuição Regional & Estados',
    badge: 'Geográfico',
    description: 'Dispersão de receitas e faturamento por UF/região.',
  },
  composition: {
    title: 'Composição & Proporção',
    badge: 'Composição',
    description: 'Distribuição proporcional entre categorias com baixa cardinalidade.',
  },
  cash_flow: {
    title: 'Fluxo de Caixa & Projeção Financeira',
    badge: 'Fluxo de Caixa',
    description: 'Comparativo diário de contas a receber e a pagar em aberto com análise de saldo projetado.',
  },
  overdue_receivables: {
    title: 'Títulos Vencidos a Receber',
    badge: 'Inadimplência',
    description: 'Análise de títulos vencidos em aberto por cliente e evolução cronológica de vencimentos.',
  },
  accounts_receivable: {
    title: 'Contas a Receber em Aberto',
    badge: 'Receber',
    description: 'Acompanhamento de títulos a receber em aberto por cliente e vencimento.',
  },
  accounts_payable: {
    title: 'Contas a Pagar em Aberto',
    badge: 'Pagar',
    description: 'Acompanhamento de títulos a pagar em aberto por fornecedor e vencimento.',
  },
  inactive_customers: {
    title: 'Recuperação de Clientes Inativos',
    badge: 'Reativação Comercial',
    description: 'Relação de clientes sem compras recentes com dados de contato, localização e histórico para estratégia comercial de recuperação.',
  },
  'financial-dashboard': {
    title: 'Painel Executivo Financeiro',
    badge: 'Executivo',
    description: 'Visão consolidada de receitas, despesas e fluxo de caixa.',
  }
};

export default function DashboardRenderer({ payload }) {
  const { 
    setDashboard, 
    triggerPrompt, 
    toggleFavorite, 
    favorites, 
    chat, 
    toggleChat,
    executiveMode,
  } = useDashboardStore();

  const [drilldownDrawer, setDrilldownDrawer] = useState(null);

  const normalizedPayload = useMemo(() => {
    if (!payload) return null;

    if (payload.data && Array.isArray(payload.data.rows) && payload.data.rows.length > 0 && (payload.data.kpis?.length > 0 || payload.data.charts?.length > 0)) {
      return payload;
    }

    let candidate = payload;
    while (candidate.payload && typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)) {
      candidate = candidate.payload;
    }

    if (candidate.data && Array.isArray(candidate.data.rows) && candidate.data.rows.length > 0 && (candidate.data.kpis?.length > 0 || candidate.data.charts?.length > 0)) {
      return {
        ...candidate,
        originPrompt: payload.originPrompt || candidate.originPrompt || payload.title || candidate.title || '',
        id: payload.id || candidate.id,
      };
    }

    const rawRows = Array.isArray(candidate.data?.rows) && candidate.data.rows.length > 0 ? candidate.data.rows
      : Array.isArray(candidate.rows) && candidate.rows.length > 0 ? candidate.rows
      : Array.isArray(candidate.records) && candidate.records.length > 0 ? candidate.records
      : Array.isArray(candidate.items) && candidate.items.length > 0 ? candidate.items
      : Array.isArray(candidate.result?.rows) && candidate.result.rows.length > 0 ? candidate.result.rows
      : Array.isArray(candidate.result?.data) && candidate.result.data.length > 0 ? candidate.result.data
      : Array.isArray(payload.data?.rows) && payload.data.rows.length > 0 ? payload.data.rows
      : Array.isArray(payload.rows) && payload.rows.length > 0 ? payload.rows
      : Array.isArray(payload.records) && payload.records.length > 0 ? payload.records
      : Array.isArray(payload.result?.rows) && payload.result.rows.length > 0 ? payload.result.rows
      : [];

    if (rawRows.length === 0) {
      return payload;
    }

    const rawColumns = (Array.isArray(candidate.data?.columns) && candidate.data.columns.length > 0) ? candidate.data.columns
      : (Array.isArray(candidate.columns) && candidate.columns.length > 0) ? candidate.columns
      : (Array.isArray(payload.columns) && payload.columns.length > 0) ? payload.columns
      : (Array.isArray(candidate.result?.columns) && candidate.result.columns.length > 0) ? candidate.result.columns
      : Object.keys(rawRows[0] || {});

    const backendKpis = candidate.backend_kpis || candidate.backendKpis || payload.backend_kpis || candidate.result?.backend_kpis || null;
    const backendInsights = candidate.backend_insights || candidate.backendInsights || payload.backend_insights || candidate.result?.backend_insights || null;
    const semanticContext = candidate.metadata || payload.metadata || candidate.result?.metadata || {};
    const originPrompt = payload.originPrompt || candidate.originPrompt || payload.title || candidate.title || '';

    try {
      const adapted = buildAdaptiveDashboard(
        rawRows,
        rawColumns,
        semanticContext,
        backendKpis,
        backendInsights
      );

      if (adapted) {
        return {
          ...adapted,
          id: payload.id || candidate.id,
          analysisId: payload.analysisId || candidate.analysisId,
          originPrompt: originPrompt || 'Consulta no Protheus',
          title: payload.title || candidate.title || originPrompt,
        };
      }
    } catch (e) {
      console.warn('[DashboardRenderer] Falha ao rodar buildAdaptiveDashboard:', e);
    }

    return {
      screenType: candidate.screenType || payload.screenType || 'ranking',
      confidence: 0.9,
      originPrompt: originPrompt || 'Consulta no Protheus',
      id: payload.id || candidate.id,
      data: {
        rows: rawRows,
        columns: rawColumns,
        kpis: candidate.kpis || payload.kpis || [],
        insights: candidate.insights || payload.insights || [],
        charts: candidate.charts || payload.charts || [],
        backendKpis,
        backendInsights,
      }
    };
  }, [payload]);

  const activePayload = normalizedPayload || payload;

  const handleExportExcel = () => {
    if (!activePayload?.data?.rows || activePayload.data.rows.length === 0) return;
    const rows = activePayload.data.rows;
    const headers = activePayload.data.columns || Object.keys(rows[0]);
    
    const csvRows = [];
    csvRows.push(headers.join(';'));
    
    for (const row of rows) {
      const values = headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) return '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(values.join(';'));
    }
    
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `copilot_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleGlobalExport = () => handleExportExcel();
    window.addEventListener('dashboard:export-excel', handleGlobalExport);
    return () => window.removeEventListener('dashboard:export-excel', handleGlobalExport);
  }, [activePayload]);

  const handlePrintPDF = () => {
    window.print();
  };

  const handleRefresh = () => {
    if (activePayload?.originPrompt) {
      triggerPrompt(activePayload.originPrompt);
    }
  };

  const handleOpenProtheusRoutine = (routineCode) => {
    window.dispatchEvent(new CustomEvent('protheus:open-routine', { detail: { routine: routineCode } }));
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-open-routine', routine: routineCode }, '*');
    }
  };

  // Drill-down dinâmico para abrir o Drawer de registros
  const handleDrillDown = (itemOrVal) => {
    if (!itemOrVal) return;
    const label = typeof itemOrVal === 'string' ? itemOrVal : (itemOrVal.label || itemOrVal.name || Object.values(itemOrVal)[0]);
    if (!label) return;

    const allRows = activePayload?.data?.rows || [];
    // Filtrar linhas que contenham o termo de busca
    const filtered = allRows.filter(row => 
      Object.values(row).some(v => String(v).toLowerCase().includes(String(label).toLowerCase()))
    );

    setDrilldownDrawer({
      title: `Detalhamento: ${label}`,
      subtitle: `${filtered.length} registro(s) encontrado(s)`,
      rows: filtered.length > 0 ? filtered : allRows.slice(0, 50),
      columns: activePayload?.data?.columns || [],
      queryTerm: label,
    });
  };

  const formatLabel = (key) => {
    if (!key) return '';
    return key
      .replace(/^VALOR_TOTAL_BRUTO_/, 'Valor Total Bruto ')
      .replace(/^VALOR_FATURADO_TOTAL_/, 'Valor Faturado Total ')
      .replace(/_NF$/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDateTick = (str) => {
    if (!str) return '';
    return formatDateBR(str);
  };

  const getKpiIcon = (type, label = '') => {
    const l = String(label).toLowerCase();
    if (l.includes('pedido') || l.includes('doc') || l.includes('nota')) return ShoppingCart;
    switch (type) {
      case 'receber': return DollarSign;
      case 'pagar': return DollarSign;
      case 'saldo': return DollarSign;
      case 'vendedor': return Award;
      case 'cliente': return Users;
      case 'produto': return Package;
      case 'count': return BarChart3;
      case 'percent': return Percent;
      default: return DollarSign;
    }
  };

  const getKpiColor = (type) => {
    switch (type) {
      case 'receber': return 'emerald';
      case 'pagar': return 'red';
      case 'saldo': return 'blue';
      case 'vendedor': return 'purple';
      case 'cliente': return 'blue';
      case 'produto': return 'amber';
      case 'count': return 'purple';
      case 'percent': return 'indigo';
      default: return 'blue';
    }
  };

  if (!activePayload) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center">
        <p className="mb-4">O Dashboard Engine aguarda instruções do Copilot.</p>
      </div>
    );
  }

  const { screenType, confidence, data } = activePayload;
  const screenConfig = SCREEN_CONFIGS[screenType] || {
    title: screenType ? screenType.replace('-', ' ') : 'Dashboard Analytics',
    badge: 'Adaptativo',
    description: 'Painel gerado dinamicamente a partir dos dados retornados pelo Protheus.'
  };

  const combinedInsights = useMemo(() => {
    const list = [];
    if (Array.isArray(data?.backendInsights)) {
      data.backendInsights.forEach(bi => {
        const severity = (bi.severity || '').toUpperCase();
        const type = severity === 'CRITICAL' ? 'critical'
          : severity === 'WARNING' ? 'warning'
          : severity === 'SUCCESS' ? 'success'
          : 'information';
        list.push({
          title: bi.title,
          description: bi.description,
          value: bi.value,
          type,
          severity,
          isAiInsight: true,
        });
      });
    }
    if (Array.isArray(data?.insights)) {
      data.insights.forEach(i => {
        if (!list.some(existing => existing.title === i.title)) {
          list.push(i);
        }
      });
    }
    return list;
  }, [data]);

  // Agrupamento de Insights por Severidade (Item 5 da Especificação)
  const { attentionInsights, positiveInsights, generalInsights } = useMemo(() => {
    const attention = [];
    const positive = [];
    const general = [];

    combinedInsights.forEach(insight => {
      const type = (insight.type || insight.severity || '').toLowerCase();
      const title = (insight.title || '').toLowerCase();

      if (
        type === 'critical' || 
        type === 'danger' || 
        type === 'warning' ||
        title.includes('pressão') || 
        title.includes('queda') || 
        title.includes('risco') || 
        title.includes('inadimplência') ||
        title.includes('atípico')
      ) {
        attention.push(insight);
      } else if (
        type === 'success' || 
        type === 'opportunity' ||
        title.includes('positivo') || 
        title.includes('crescimento') || 
        title.includes('superam') ||
        title.includes('diversificada') || 
        title.includes('pulverizada')
      ) {
        positive.push(insight);
      } else {
        general.push(insight);
      }
    });

    return { attentionInsights: attention, positiveInsights: positive, generalInsights: general };
  }, [combinedInsights]);

  const displayedKpis = executiveMode ? (data?.kpis || []).slice(0, 4) : (data?.kpis || []);
  const primaryKpi = displayedKpis[0] || null;
  const secondaryKpis = displayedKpis.slice(1);

  const displayedCharts = executiveMode ? (data?.charts || []).slice(0, 1) : (data?.charts || []);
  const suggestions = activePayload?.suggestions || data?.suggestions || [];

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center bg-[var(--surface-1)] rounded-2xl border border-[var(--border)]">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-[var(--text-muted)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Nenhum registro retornado</h2>
        <p className="text-xs max-w-md text-[var(--text-secondary)]">A consulta no ERP Protheus foi concluída, mas não retornou registros para os filtros e período informados.</p>
      </div>
    );
  }

  // Identificação de rotinas do Protheus contextuais (Item 9/10 da Especificação)
  const protheusRoutines = useMemo(() => {
    const prompt = (activePayload.originPrompt || '').toLowerCase();
    const st = (screenType || '').toLowerCase();

    if (st.includes('cash_flow') || prompt.includes('caixa') || prompt.includes('pagar') || prompt.includes('receber')) {
      return [
        { name: 'Contas a Receber', code: 'FINA040', desc: 'Títulos e Baixas' },
        { name: 'Contas a Pagar', code: 'FINA050', desc: 'Compromissos' },
        { name: 'Fluxo de Caixa', code: 'FINA020', desc: 'Movimentações Bancárias' },
      ];
    }
    if (st.includes('customer') || prompt.includes('cliente')) {
      return [
        { name: 'Cadastro de Clientes', code: 'CRMA980', desc: 'Dados e Crédito' },
        { name: 'Pedidos de Venda', code: 'MATA410', desc: 'Histórico de Compras' },
      ];
    }
    if (st.includes('seller') || prompt.includes('vendedor')) {
      return [
        { name: 'Cadastro de Vendedores', code: 'MATA040', desc: 'Equipe Comercial' },
        { name: 'Metas e Comissões', code: 'MATA490', desc: 'Desempenho' },
      ];
    }
    return [
      { name: 'Faturamento / Notas', code: 'MATA410', desc: 'Documentos de Saída' },
      { name: 'Consulta Genérica', code: 'CRMA980', desc: 'Cadastros Gerais' },
    ];
  }, [screenType, activePayload.originPrompt]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex h-full flex-col gap-6 pb-20"
    >
      {/* ────────────────────────────────────────────────────────────────────────
          CAMADA 1: AÇÕES RÁPIDAS & CONTEXTO DA CONSULTA
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-[var(--text-muted)] shrink-0">Origem:</span>
          <span className="font-medium text-[var(--text-primary)] truncate">
            "{activePayload.originPrompt || 'Consulta Protheus'}"
          </span>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] shrink-0">
            {screenConfig.badge}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <ExecutiveModeToggle />

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer shadow-2xs"
            title="Atualizar dados da consulta no ERP"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer shadow-2xs"
            title="Exportar para Excel"
          >
            <FileSpreadsheet size={13} className="text-emerald-500" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer shadow-2xs"
            title="Imprimir ou salvar em PDF"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          CAMADA 2: HIERARQUIA REAL DE KPIS (HERO KPI + APOIO)
          ──────────────────────────────────────────────────────────────────────── */}
      {displayedKpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryKpi && (
            <div className={displayedKpis.length >= 3 ? "col-span-1 md:col-span-2 lg:col-span-2" : "col-span-1"}>
              <MetricCard 
                title={formatLabel(primaryKpi.label)} 
                subtitle={primaryKpi.subtitle || 'Indicador Principal Consolidado'}
                value={primaryKpi.format === 'currency' 
                  ? `R$ ${primaryKpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : primaryKpi.format === 'percent'
                  ? `${primaryKpi.value.toFixed(1)}%`
                  : primaryKpi.value.toLocaleString('pt-BR')} 
                icon={getKpiIcon(primaryKpi.type, primaryKpi.label)} 
                color={getKpiColor(primaryKpi.type)} 
                isHero={true}
                onClick={() => handleDrillDown(primaryKpi.label)}
              />
            </div>
          )}

          {secondaryKpis.map((kpi, idx) => (
            <div key={idx} className="col-span-1">
              <MetricCard 
                title={formatLabel(kpi.label)} 
                subtitle={kpi.subtitle}
                value={kpi.format === 'currency' 
                  ? `R$ ${kpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : kpi.format === 'percent'
                  ? `${kpi.value.toFixed(1)}%`
                  : kpi.value.toLocaleString('pt-BR')} 
                icon={getKpiIcon(kpi.type, kpi.label)} 
                color={getKpiColor(kpi.type)} 
                onClick={() => handleDrillDown(kpi.label)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          CAMADA 3: GRID 8 COLUNAS (GRÁFICOS) + 4 COLUNAS (RESUMO DA IA)
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna da Esquerda (8 Colunas em telas grandes): Gráficos */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {displayedCharts.length > 0 ? (
            <div className="flex flex-col gap-6">
              {displayedCharts.map((chart, idx) => {
                if (chart.chartType === 'grouped_bar') {
                  const formattedData = (chart.data || []).map(p => ({
                    ...p,
                    date: formatDateTick(p.date || p.label),
                    fullDate: p.fullLabel || p.date,
                  }));
                  return (
                    <BarChartCard 
                      key={idx}
                      title={chart.title} 
                      data={formattedData} 
                      xAxisKey={chart.xAxisKey || 'date'} 
                      series={chart.series}
                      onBarClick={handleDrillDown}
                    />
                  );
                }
                if (chart.chartType === 'line') {
                  const formattedPoints = (chart.data || []).map(p => ({
                    ...p,
                    label: formatDateTick(p.label),
                    fullLabel: p.fullLabel || (typeof p.label === 'string' && p.label.length === 8 ? `${p.label.substring(6, 8)}/${p.label.substring(4, 6)}/${p.label.substring(0, 4)}` : p.label),
                  }));
                  return (
                    <LineChartCard 
                      key={idx}
                      title={chart.title} 
                      data={formattedPoints} 
                      xAxisKey={chart.xAxisKey || 'label'} 
                      dataKey={chart.dataKey || 'value'} 
                      referenceLineY={chart.referenceLineY}
                      color={chart.color || "#10b981"} 
                    />
                  );
                }
                if (chart.chartType === 'donut') {
                  return (
                    <DonutChartCard 
                      key={idx}
                      title={chart.title} 
                      data={chart.data} 
                      dataKey={chart.dataKey || 'value'} 
                      nameKey={chart.nameKey || 'name'} 
                    />
                  );
                }
                return (
                  <BarChartCard 
                    key={idx}
                    title={chart.title} 
                    data={chart.data} 
                    xAxisKey={chart.xAxisKey || 'label'} 
                    dataKey={chart.dataKey || 'value'} 
                    color={chart.color || "#3b82f6"} 
                    onBarClick={handleDrillDown}
                  />
                );
              })}
            </div>
          ) : (
            data?.series?.length > 0 && (
              <div className="flex flex-col gap-6">
                {data.series.map((s, idx) => {
                  const formattedPoints = s.points.map(p => ({ ...p, label: formatDateTick(p.label) }));
                  return (
                    <BarChartCard 
                      key={idx}
                      title={formatLabel(s.label)} 
                      data={formattedPoints} 
                      xAxisKey="label" 
                      color="#3b82f6" 
                      onBarClick={handleDrillDown}
                    />
                  );
                })}
              </div>
            )
          )}

          {/* Seção Padronizada: Ações no Protheus (Item 10 da Especificação) */}
          <div className="p-4 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ExternalLink size={15} className="text-[var(--brand)]" />
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Ações no ERP Protheus
                </h3>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">Atalhos diretos para rotinas TOTVS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {protheusRoutines.map((routine) => (
                <button
                  key={routine.code}
                  type="button"
                  onClick={() => handleOpenProtheusRoutine(routine.code)}
                  className="flex flex-col items-start p-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] hover:border-[var(--border-hover)] text-left transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                      {routine.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[var(--text-muted)] font-semibold">
                      {routine.code}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {routine.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna da Direita (4 Colunas em telas grandes): Resumo da IA & Severidades */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Sparkles size={16} className="text-[var(--brand)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Resumo da Inteligência Artificial</h3>
            </div>

            {/* Grupo 1: Atenção Necessária (Alertas / Riscos) */}
            {attentionInsights.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 px-1">
                  <AlertTriangle size={12} />
                  <span>Atenção Necessária</span>
                </span>
                {attentionInsights.map((ins, idx) => (
                  <InsightCard 
                    key={idx}
                    title={ins.title}
                    description={ins.description}
                    value={ins.value}
                    type="warning"
                  />
                ))}
              </div>
            )}

            {/* Grupo 2: Sinais Positivos & Oportunidades */}
            {positiveInsights.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 px-1">
                  <CheckCircle2 size={12} />
                  <span>Sinais Positivos</span>
                </span>
                {positiveInsights.map((ins, idx) => (
                  <InsightCard 
                    key={idx}
                    title={ins.title}
                    description={ins.description}
                    value={ins.value}
                    type="success"
                  />
                ))}
              </div>
            )}

            {/* Grupo 3: Informações & Contexto Geral */}
            {generalInsights.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 px-1">
                  <Lightbulb size={12} />
                  <span>Observações Analíticas</span>
                </span>
                {generalInsights.map((ins, idx) => (
                  <InsightCard 
                    key={idx}
                    title={ins.title}
                    description={ins.description}
                    value={ins.value}
                    type="information"
                  />
                ))}
              </div>
            )}

            {combinedInsights.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                Nenhum ponto atípico ou desvio relevante detectado para o período.
              </p>
            )}
          </div>

          {/* Recomendações e Sugestões do Copiloto */}
          {suggestions.length > 0 && (
            <div className="p-4 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--brand)]" />
                <span>Explorar Próximos Passos:</span>
              </span>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => triggerPrompt(sug)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] text-left transition-all cursor-pointer group"
                  >
                    <span>{sug}</span>
                    <ChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-[var(--brand)] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          CAMADA 4: DETALHAMENTO EM TABELA (MODO ANALÍTICO OU ROLAGEM)
          ──────────────────────────────────────────────────────────────────────── */}
      {!executiveMode && data?.rows?.length > 0 && (
        <div className="mt-2 p-5 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Tabela Detalhada de Registros</h3>
              <p className="text-xs text-[var(--text-muted)]">Clique em qualquer linha para disparar análise contextualizada no Copilot.</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]">
              {data.rows.length} {data.rows.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <DataGrid 
            data={data.rows} 
            columns={data?.columns?.length > 0 ? data.columns.map(col => {
              const key = typeof col === 'string' ? col : (col.key || col.name || col.accessorKey || '');
              const header = typeof col === 'string' ? humanizeColumnName(col) : (col.header || col.label || humanizeColumnName(key));
              return { header, accessorKey: key };
            }) : []} 
            onRowClick={(row) => handleDrillDown(row)}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          CAMADA 5: DRAWER DE DRILL-DOWN LATERAL (SLIDE OVER)
          ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drilldownDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrilldownDrawer(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 cursor-pointer"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[var(--surface-1)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{drilldownDrawer.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{drilldownDrawer.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrilldownDrawer(null)}
                  className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <DataGrid 
                  data={drilldownDrawer.rows} 
                  columns={drilldownDrawer.columns.length > 0 ? drilldownDrawer.columns.map(col => {
                    const key = typeof col === 'string' ? col : (col.key || col.name || col.accessorKey || '');
                    const header = typeof col === 'string' ? humanizeColumnName(col) : (col.header || col.label || humanizeColumnName(key));
                    return { header, accessorKey: key };
                  }) : []}
                  onRowClick={(row) => {
                    setDrilldownDrawer(null);
                    handleDrillDown(row);
                  }}
                />
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => triggerPrompt(`Detalhamento completo de ${drilldownDrawer.queryTerm}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--brand)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Perguntar sobre este filtro no Chat
                </button>
                <button
                  type="button"
                  onClick={() => setDrilldownDrawer(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

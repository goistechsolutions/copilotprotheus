import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { BarChartCard } from '../charts/BarChartCard';
import { LineChartCard } from '../charts/LineChartCard';
import { DonutChartCard } from '../charts/DonutChartCard';
import { DataGrid } from '../ui/DataGrid';
import { MetricCard } from '../kpis/MetricCard';
import { MetricsRow } from '../kpis/MetricsRow';
import { InsightCard } from '../insights/InsightCard';
import { InsightsGrid } from '../insights/InsightsGrid';
import { 
  DollarSign, Users, ShoppingCart, Percent, TrendingUp, Award, BarChart3, 
  Sparkles, ArrowLeft, RefreshCw, FileSpreadsheet, Printer, Bookmark, BookmarkCheck, MessageSquare 
} from 'lucide-react';
import { buildAdaptiveDashboard } from '../../services/adaptiveDashboardEngine';
import { useDashboardStore } from '../../stores/useDashboardStore';

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
    toggleChat 
  } = useDashboardStore();

  const isFavorited = useMemo(() => {
    if (!payload || !favorites) return false;
    return favorites.some(f => f.originPrompt === payload.originPrompt || (f.id && f.id === payload.id));
  }, [payload, favorites]);

  const handleExportExcel = () => {
    if (!payload?.data?.rows || payload.data.rows.length === 0) return;
    const rows = payload.data.rows;
    const headers = payload.data.columns || Object.keys(rows[0]);
    
    // Gerar CSV com separador ; e BOM UTF-8 para Excel abrir nativamente com acentos corretos
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
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleRefresh = () => {
    if (payload?.originPrompt) {
      triggerPrompt(payload.originPrompt);
    }
  };

  const handleContinueConversation = () => {
    if (!chat.isOpen) {
      toggleChat();
    }
  };

  // Drill-down dinâmico baseado na entidade clicada
  const handleDrillDown = (itemOrVal) => {
    if (!itemOrVal) return;
    const label = typeof itemOrVal === 'string' ? itemOrVal : (itemOrVal.label || itemOrVal.name || Object.values(itemOrVal)[0]);
    if (!label) return;

    const screenType = payload?.screenType || '';
    if (screenType.includes('seller') || payload?.originPrompt?.toLowerCase().includes('vendedor')) {
      triggerPrompt(`Clientes atendidos pelo vendedor ${label}`);
    } else if (screenType.includes('customer') || payload?.originPrompt?.toLowerCase().includes('cliente')) {
      triggerPrompt(`Produtos mais comprados pelo cliente ${label}`);
    } else if (screenType.includes('product') || payload?.originPrompt?.toLowerCase().includes('produto')) {
      triggerPrompt(`Clientes que compraram o produto ${label}`);
    } else {
      triggerPrompt(`Detalhamento de ${label}`);
    }
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
    const s = String(str).trim();
    if (s.length === 8 && !isNaN(s)) {
      return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(2, 4)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const parts = s.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0].slice(2, 4)}`;
    }
    return s;
  };

  const getKpiIcon = (type) => {
    switch (type) {
      case 'receber': return DollarSign;
      case 'pagar': return DollarSign;
      case 'saldo': return TrendingUp;
      case 'sum': return DollarSign;
      case 'avg': return TrendingUp;
      case 'max': return Award;
      case 'count': return Users;
      default: return BarChart3;
    }
  };

  const getKpiColor = (type) => {
    switch (type) {
      case 'receber': return 'emerald';
      case 'pagar': return 'red';
      case 'saldo': return 'blue';
      case 'sum': return 'blue';
      case 'avg': return 'emerald';
      case 'max': return 'amber';
      case 'count': return 'purple';
      default: return 'blue';
    }
  };


  const handleRenderMock = () => {
    const sampleRows = [
      { F2_CLIENTE: 'ATACADAO S.A.', VALOR_FATURADO: 450000.00, F2_EMISSAO: '20260301', ESTADO: 'SP' },
      { F2_CLIENTE: 'CARREFOUR COMERCIO', VALOR_FATURADO: 320000.00, F2_EMISSAO: '20260302', ESTADO: 'SP' },
      { F2_CLIENTE: 'PAO DE ACUCAR', VALOR_FATURADO: 280000.00, F2_EMISSAO: '20260303', ESTADO: 'RJ' },
      { F2_CLIENTE: 'ASSAI ATACADISTA', VALOR_FATURADO: 210000.00, F2_EMISSAO: '20260304', ESTADO: 'MG' },
      { F2_CLIENTE: 'MERCADO LIVRE', VALOR_FATURADO: 180000.00, F2_EMISSAO: '20260305', ESTADO: 'PR' },
      { F2_CLIENTE: 'MAGAZINE LUIZA', VALOR_FATURADO: 140000.00, F2_EMISSAO: '20260306', ESTADO: 'SP' },
      { F2_CLIENTE: 'CASAS BAHIA', VALOR_FATURADO: 95000.00, F2_EMISSAO: '20260307', ESTADO: 'RS' },
    ];
    const sample = buildAdaptiveDashboard(sampleRows, ['F2_CLIENTE', 'VALOR_FATURADO', 'F2_EMISSAO', 'ESTADO']);
    if (sample) setDashboard(sample);
  };

  if (!payload) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400 p-8 text-center">
        <p className="mb-4">O Dashboard Engine aguarda instruções do Copiloto.</p>
        <button 
          onClick={handleRenderMock}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors font-medium text-sm"
        >
          Visualizar Demonstração Adaptativa
        </button>
      </div>
    );
  }

  const { screenType, confidence, data } = payload;
  const screenConfig = SCREEN_CONFIGS[screenType] || {
    title: screenType ? screenType.replace('-', ' ') : 'Dashboard Analytics',
    badge: 'Adaptativo',
    description: 'Painel gerado dinamicamente a partir dos dados retornados pelo Protheus.'
  };
  
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhum registro encontrado</h2>
        <p className="text-sm max-w-md">A consulta foi concluída, mas não retornou dados para o período e filtros solicitados.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex h-full flex-col gap-6 p-4 sm:p-6 pb-20"
    >
      {/* Barra de Ações e Contexto Unificado (Página 9 da Especificação) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 min-w-0">
          <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">Origem:</span>
          <span className="italic font-medium text-slate-800 dark:text-slate-200 truncate">
            "{payload.originPrompt || 'Consulta no Protheus'}"
          </span>
        </div>

        {/* Action Bar Completa */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Voltar ao Chat */}
          <button
            onClick={() => setDashboard(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm shrink-0"
            title="Fechar Dashboard e voltar ao fluxo de chat"
          >
            <ArrowLeft size={13} />
            <span>Voltar ao Chat</span>
          </button>

          {/* Atualizar Dados */}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm shrink-0"
            title="Recalcular e atualizar dados da consulta"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Exportar Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm shrink-0"
            title="Baixar planilha formatada para Excel"
          >
            <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Exportar PDF */}
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm shrink-0"
            title="Imprimir ou salvar em PDF"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Salvar Painel (Favoritos) */}
          <button
            onClick={() => toggleFavorite(payload)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shadow-sm shrink-0 ${
              isFavorited
                ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-semibold'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={isFavorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          >
            {isFavorited ? <BookmarkCheck size={13} className="text-amber-500 fill-amber-500" /> : <Bookmark size={13} />}
            <span className="hidden sm:inline">{isFavorited ? 'Salvo' : 'Salvar Painel'}</span>
          </button>

          {/* Continuar Conversa */}
          <button
            onClick={handleContinueConversation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm shrink-0"
            title="Retomar a conversa no Copiloto"
          >
            <MessageSquare size={13} />
            <span>Continuar Conversa</span>
          </button>
        </div>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
              {screenConfig.title}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              <Sparkles size={12} />
              {screenConfig.badge}
            </span>
            {confidence && (
              <span className="text-xs text-slate-400 font-medium">
                ({Math.round(confidence * 100)}% aderência)
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">{screenConfig.description}</p>
        </div>
      </header>
      
      {/* Camada 3: KPIs Dinâmicos Baseados no Schema */}
      {data?.kpis?.length > 0 && (
        <MetricsRow>
          {data.kpis.map((kpi, idx) => (
            <MetricCard 
              key={idx}
              title={formatLabel(kpi.label)} 
              value={kpi.format === 'currency' 
                ? `R$ ${kpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                : kpi.format === 'percent'
                ? `${kpi.value.toFixed(1)}%`
                : kpi.value.toLocaleString('pt-BR')} 
              icon={getKpiIcon(kpi.type)} 
              color={getKpiColor(kpi.type)} 
            />
          ))}
        </MetricsRow>
      )}

      {/* Camada 3: Insights Automatizados (Concentração, Curva ABC, Pareto) */}
      {data?.insights?.length > 0 && (
        <InsightsGrid>
          {data.insights.map((insight, idx) => (
            <InsightCard 
              key={idx}
              title={insight.title || "Insight"} 
              description={insight.description} 
              value={insight.value}
              type={insight.type || "information"}
            />
          ))}
        </InsightsGrid>
      )}
      
      {/* Camada 3: Gráficos com Regras de Cardinalidade e Drill-Down Interativo */}
      {data?.charts?.length > 0 ? (
        <div className={`grid grid-cols-1 gap-6 ${data.charts.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
          {data.charts.map((chart, idx) => {
            if (chart.chartType === 'grouped_bar') {
              const formattedData = (chart.data || []).map(p => ({
                ...p,
                date: formatDateTick(p.date || p.label),
                fullDate: p.fullLabel || p.date,
              }));
              return (
                <div key={idx} className={data.charts.length === 1 ? 'col-span-1' : ''}>
                  <BarChartCard 
                    title={chart.title} 
                    data={formattedData} 
                    xAxisKey={chart.xAxisKey || 'date'} 
                    series={chart.series}
                    onBarClick={handleDrillDown}
                  />
                </div>
              );
            }
            if (chart.chartType === 'line') {
              const formattedPoints = (chart.data || []).map(p => ({
                ...p,
                label: formatDateTick(p.label),
                fullLabel: p.fullLabel || (typeof p.label === 'string' && p.label.length === 8 ? `${p.label.substring(6, 8)}/${p.label.substring(4, 6)}/${p.label.substring(0, 4)}` : p.label),
              }));
              return (
                <div key={idx} className={data.charts.length === 1 ? 'col-span-1' : ''}>
                  <LineChartCard 
                    title={chart.title} 
                    data={formattedPoints} 
                    xAxisKey={chart.xAxisKey || 'label'} 
                    dataKey={chart.dataKey || 'value'} 
                    referenceLineY={chart.referenceLineY}
                    color={chart.color || "#10b981"} 
                  />
                </div>
              );
            }
            if (chart.chartType === 'donut') {
              return (
                <div key={idx} className={data.charts.length === 1 ? 'col-span-1' : ''}>
                  <DonutChartCard 
                    title={chart.title} 
                    data={chart.data} 
                    dataKey={chart.dataKey || 'value'} 
                    nameKey={chart.nameKey || 'name'} 
                  />
                </div>
              );
            }
            // Bar chart (default) com suporte a onBarClick para drill-down
            return (
              <div key={idx} className={data.charts.length === 1 ? 'col-span-1' : ''}>
                <BarChartCard 
                  title={chart.title} 
                  data={chart.data} 
                  xAxisKey={chart.xAxisKey || 'label'} 
                  dataKey={chart.dataKey || 'value'} 
                  color={chart.color || "#3b82f6"} 
                  onBarClick={handleDrillDown}
                />
              </div>
            );
          })}

        </div>
      ) : (
        // Fallback compatibilidade retroativa para data.series
        data?.series?.length > 0 && (
          <div className={`grid grid-cols-1 gap-6 ${data.series.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
            {data.series.map((s, idx) => {
              const formattedPoints = s.points.map(p => ({ ...p, label: formatDateTick(p.label) }));
              return (
                <div key={idx} className={data.series.length === 1 ? "col-span-1" : ""}>
                  <BarChartCard 
                    title={formatLabel(s.label)} 
                    data={formattedPoints} 
                    xAxisKey="label" 
                    color="#3b82f6" 
                    onBarClick={handleDrillDown}
                  />
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Camada 3: Tabela Detalhada com Drill-Down ao Clicar na Linha */}
      {data?.rows?.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Detalhamento dos Dados</h3>
              <p className="text-xs text-slate-500">Clique em qualquer linha da tabela para detalhar a entidade no Copiloto.</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {data.rows.length} {data.rows.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <DataGrid 
            data={data.rows} 
            columns={data?.columns?.length > 0 ? data.columns.map(col => ({ header: col, accessorKey: col })) : []} 
            onRowClick={(row) => handleDrillDown(row)}
          />
        </div>
      )}
    </motion.div>
  );
}

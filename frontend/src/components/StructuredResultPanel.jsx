import React, { useMemo, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { downloadStructuredReport, exportStructuredReport } from '../services/api';
import { Bar, getElementAtEvent } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  Download,
  Info,
  Search,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  DollarSign,
  Percent,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, Filler);

// Formatters
const formatCurrency = value =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatNumber = value =>
  new Intl.NumberFormat('pt-BR').format(value);

function parseNumeric(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(',', '.');
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

export default function StructuredResultPanel({ result, context, onAction, onDrillDown }) {
  const rows = result?.rows || [];
  const columns = result?.columns || [];
  const kpis = result?.kpis || [];
  const series = result?.series || [];
  const dimensions = result?.dimensions || [];
  const domain = result?.metadata?.domain || '';

  const chartRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // What-If Simulator state (RF012)
  const [showSimulator, setShowSimulator] = useState(false);
  const [simPriceDelta, setSimPriceDelta] = useState(0);
  const [simCostDelta, setSimCostDelta] = useState(0);
  const [simDelinquencyDelta, setSimDelinquencyDelta] = useState(0);

  // Calcula a receita/faturamento base real a partir dos KPIs ou das linhas retornadas pelo Protheus
  const realBaseRevenue = useMemo(() => {
    // 1. Tentar pegar de KPI de valor financeiro ou faturamento
    const revenueKpi = kpis.find(k => 
      k.format === 'currency' || 
      /FATURAMENTO|RECEITA|TOTAL|VALOR|SALDO|MONTANTE/i.test(k.label || '')
    );
    const parsedKpi = parseNumeric(revenueKpi?.value);
    if (parsedKpi && parsedKpi > 0) return parsedKpi;

    // 2. Tentar somar coluna de valor/faturamento nas linhas
    const valCol = columns.find(c => /VALOR|VALBRUT|VALMERC|TOTAL|TOTAL_FAT|SALDO|FATURAMENTO/i.test(c));
    if (valCol && rows.length > 0) {
      const sum = rows.reduce((acc, row) => acc + (parseNumeric(row[valCol]) || 0), 0);
      if (sum > 0) return sum;
    }

    // 3. Fallback a partir de backend_kpis se disponível
    const backendTotal = parseNumeric(result?.backend_kpis?.total);
    if (backendTotal && backendTotal > 0) return backendTotal;

    return 0;
  }, [kpis, columns, rows, result]);

  // Cálculos do simulador de sensibilidade sobre a base real
  const simulationMetrics = useMemo(() => {
    const base = realBaseRevenue > 0 ? realBaseRevenue : 1000000; // referência se base zerada
    const priceImpact = base * (simPriceDelta / 100);
    const costImpact = -(base * 0.58) * (simCostDelta / 100);
    const delinquencyImpact = -(base * 0.02) * (simDelinquencyDelta / 100);
    const totalImpact = priceImpact + costImpact + delinquencyImpact;
    const marginDelta = Number(((totalImpact / base) * 100).toFixed(2));
    const isPositive = totalImpact >= 0;

    return {
      base,
      priceImpact,
      costImpact,
      delinquencyImpact,
      totalImpact,
      marginDelta,
      isPositive,
      formattedTotal: (isPositive ? '+ ' : '- ') + formatCurrency(Math.abs(totalImpact)),
    };
  }, [realBaseRevenue, simPriceDelta, simCostDelta, simDelinquencyDelta]);

  const handleResetSimulator = () => {
    setSimPriceDelta(0);
    setSimCostDelta(0);
    setSimDelinquencyDelta(0);
  };

  const handleAskSimulationCopilot = () => {
    const prompt = `Avaliar projeção de sensibilidade sobre a base real de ${formatCurrency(simulationMetrics.base)}: Variação de Preço (${simPriceDelta >= 0 ? '+' : ''}${simPriceDelta}%), Custos (${simCostDelta >= 0 ? '+' : ''}${simCostDelta}%) e Inadimplência (${simDelinquencyDelta >= 0 ? '+' : ''}${simDelinquencyDelta}%). Qual o impacto projetado na margem e viabilidade no Protheus?`;
    if (typeof onDrillDown === 'function') {
      onDrillDown(prompt);
    } else if (typeof onAction === 'function') {
      onAction('ask_copilot', { prompt });
    }
  };

  // Helper para identificar se uma coluna representa entidade acionável de drill-down
  const getDrillDownType = (colName) => {
    const col = String(colName || '').toUpperCase();
    if (/CLIENTE|NOMCLI|A1_NOME|A1_COD|SACADO/.test(col)) return 'cliente';
    if (/FORNECEDOR|NOMFOR|A2_NOME|A2_COD|FORNECE/.test(col)) return 'fornecedor';
    if (/PRODUTO|B1_DESC|B1_COD|COD_PROD|ITEM|DESCRIC/.test(col)) return 'produto';
    if (/VENDEDOR|NOMVEN|A3_NOME|A3_COD|REPRESENTANTE/.test(col)) return 'vendedor';
    return null;
  };

  // Executa o drill-down enviando comando natural ao Copilot
  const triggerDrillDown = (entityType, entityValue, extraRowData = null) => {
    const val = String(entityValue || '').trim();
    if (!val || val === '---') return;

    let drillPrompt = '';
    if (entityType === 'cliente') {
      if (domain === 'finance' || domain === 'receivables') {
        drillPrompt = `Listar extrato detalhado de títulos a receber do cliente ${val}`;
      } else {
        drillPrompt = `Detalhar pedidos e histórico de faturamento do cliente ${val}`;
      }
    } else if (entityType === 'fornecedor') {
      drillPrompt = `Listar títulos a pagar e notas de entrada do fornecedor ${val}`;
    } else if (entityType === 'produto') {
      drillPrompt = `Ver movimentações e posição de estoque do produto ${val}`;
    } else if (entityType === 'vendedor') {
      drillPrompt = `Detalhar vendas e pedidos faturados do vendedor ${val}`;
    } else {
      drillPrompt = `Detalhes de ${val}`;
    }

    if (typeof onDrillDown === 'function') {
      onDrillDown(drillPrompt);
    } else if (typeof onAction === 'function') {
      onAction('drill_down', { prompt: drillPrompt, entityType, entityValue, row: extraRowData });
    }
  };

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    const elements = getElementAtEvent(chartRef.current, event);
    if (!elements || elements.length === 0) return;

    const firstElement = elements[0];
    const index = firstElement.index;
    const point = series[0]?.points?.[index];
    if (point?.label) {
      // Infere o tipo da entidade a partir do rótulo da série ou do domínio
      let entityType = 'cliente';
      const seriesLabel = String(series[0]?.label || '').toLowerCase();
      if (seriesLabel.includes('produto') || seriesLabel.includes('item')) entityType = 'produto';
      else if (seriesLabel.includes('fornecedor')) entityType = 'fornecedor';
      else if (seriesLabel.includes('vendedor')) entityType = 'vendedor';

      triggerDrillDown(entityType, point.label);
    }
  };

  const displayValue = val => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return formatNumber(val);
      return formatNumber(val); // will use default locale format
    }
    return String(val);
  };

  // Helper for KPI formatting
  const formatKpiValue = (value, format) => {
    if (value === null || value === undefined) return '---';
    if (format === 'currency') return formatCurrency(value);
    if (format === 'percent') return `${formatNumber(value)}%`;
    return formatNumber(value);
  };

  // Chart Data
  const chartData = useMemo(() => {
    if (!series.length) return null;
    const s = series[0];
    if (!s.points || !s.points.length) return null;

    const limit = 12; // cap visual
    const points = s.points.slice(0, limit);

    return {
      labels: points.map(p => p.label),
      datasets: [
        {
          label: s.label,
          data: points.map(p => p.value),
          backgroundColor: 'rgba(0, 79, 206, 0.9)',
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ],
    };
  }, [series]);

  // Tabela filtrada e ordenada
  const filteredRows = useMemo(() => {
    let resultRows = [...rows];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      resultRows = resultRows.filter(row =>
        columns.some(col => String(row[col] ?? '').toLowerCase().includes(term))
      );
    }
    if (sortConfig.key) {
      resultRows.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        const numA = parseNumeric(valA);
        const numB = parseNumeric(valB);
        if (numA !== null && numB !== null) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
        return sortConfig.direction === 'asc'
          ? String(valA ?? '').localeCompare(String(valB ?? ''))
          : String(valB ?? '').localeCompare(String(valA ?? ''));
      });
    }
    return resultRows;
  }, [rows, columns, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleExportCsv = () => {
    if (!rows.length) return;
    const headers = columns.join(',');
    const csvRows = rows.map(row => columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers, ...csvRows].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `protheus_export_${Date.now()}.csv`;
    link.click();
  };

  const exportStructured = async (format) => {
    if (!rows.length) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = {
        title: 'Relatório Executivo Protheus',
        tenant_code: context?.tenant_id,
        environment_code: context?.environment,
        format,
        columns,
        rows
      };
      const response = await exportStructuredReport(payload);
      if (response?.download_url) {
        const blob = await downloadStructuredReport(response.download_url);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setExportError(err.message || 'Falha ao exportar.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both pb-20">
      
      {/* 1. HEADER & RESUMO */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="prose prose-sm dark:prose-invert max-w-3xl leading-relaxed text-[#171C20] dark:text-slate-200">
          <ReactMarkdown>
            {result?.message || 'Consulta concluída.'}
          </ReactMarkdown>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSimulator(prev => !prev)}
            className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              showSimulator
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 border-border-hairline text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal size={15} className={showSimulator ? 'text-cyan-300' : 'text-indigo-600 dark:text-indigo-400'} />
            <span>Simulador What-If</span>
            {showSimulator ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {rows.length > 0 && (
            <>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => exportStructured('excel')}
                className="h-9 px-4 bg-white dark:bg-slate-800 border border-border-hairline rounded-xl text-[13px] font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <span className="w-4 h-4 border-2 border-[#004FCE] border-t-transparent rounded-full animate-spin" /> : <Download size={15} />}
                <span>Excel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* SIMULADOR WHAT-IF CONECTADO A DADOS REAIS (RF012) */}
      {showSimulator && (
        <section className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50/80 dark:from-slate-900 dark:via-[#1E293B] dark:to-slate-900 p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Simulador Executivo What-If & Sensibilidade
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    Base Real: {formatCurrency(simulationMetrics.base)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Simule o impacto de variações de preço, custos e inadimplência aplicados diretamente aos números desta consulta.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSimulator}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Resetar</span>
              </button>
              <button
                type="button"
                onClick={handleAskSimulationCopilot}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#004FCE] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>Avaliar com Copiloto</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-center">
            {/* Sliders (3 Colunas) */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Slider 1: Preço Médio */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-[#004FCE]" />
                    Variação de Preço
                  </span>
                  <span className="font-mono text-[#004FCE] dark:text-blue-400 font-black text-sm">
                    {simPriceDelta >= 0 ? '+' : ''}{simPriceDelta}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="15"
                  step="0.5"
                  value={simPriceDelta}
                  onChange={e => setSimPriceDelta(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#004FCE]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>-10%</span>
                  <span>0%</span>
                  <span>+15%</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 text-right">
                  Impacto: {formatCurrency(simulationMetrics.priceImpact)}
                </div>
              </div>

              {/* Slider 2: Custos de Insumos */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-500" />
                    Custos (COGS / Insumos)
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-black text-sm">
                    {simCostDelta >= 0 ? '+' : ''}{simCostDelta}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="15"
                  step="0.5"
                  value={simCostDelta}
                  onChange={e => setSimCostDelta(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>-10%</span>
                  <span>0%</span>
                  <span>+15%</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 text-right">
                  Impacto: {formatCurrency(simulationMetrics.costImpact)}
                </div>
              </div>

              {/* Slider 3: Inadimplência */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                    Inadimplência Carteira
                  </span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-black text-sm">
                    {simDelinquencyDelta >= 0 ? '+' : ''}{simDelinquencyDelta}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-3"
                  max="5"
                  step="0.2"
                  value={simDelinquencyDelta}
                  onChange={e => setSimDelinquencyDelta(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>-3%</span>
                  <span>0%</span>
                  <span>+5%</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 text-right">
                  Impacto: {formatCurrency(simulationMetrics.delinquencyImpact)}
                </div>
              </div>
            </div>

            {/* Caixa de Impacto Projetado */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all ${
                simulationMetrics.isPositive
                  ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30'
                  : 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sensibilidade no EBITDA / Margem
              </div>
              <div
                className={`text-2xl font-black tracking-tight mt-1 ${
                  simulationMetrics.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {simulationMetrics.formattedTotal}
              </div>
              <div className="text-[11px] font-bold mt-1 text-slate-600 dark:text-slate-300">
                Margem Estimada: {simulationMetrics.isPositive ? '+' : ''}
                {simulationMetrics.marginDelta}%
              </div>
            </div>
          </div>
        </section>
      )}

      {exportError && (
        <div className="text-red-500 text-sm mt-2">{exportError}</div>
      )}

      {/* ERROR / BLOCKED BANNER */}
      {(result?.status === 'execution_failed' || result?.status === 'error' || result?.status === 'validation_failed') && (
        <div className="p-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#171C20] dark:text-white">
                Falha na Consulta
              </h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {result.execution_error || result.error || result.message || result.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. BENTO KPI GRID (4 Cards) */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.slice(0, 4).map((kpi, index) => (
            <div key={index} className={`p-5 rounded-2xl relative overflow-hidden group border ${index === 0 ? 'bg-[#004FCE] text-white border-blue-400/40 shadow-md' : 'stitch-card'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${index === 0 ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                {kpi.label}
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className={`text-[26px] font-bold tracking-tight ${index === 0 ? 'text-white' : 'text-[#171C20] dark:text-white'}`}>
                  {formatKpiValue(kpi.value, kpi.format)}
                </h2>
              </div>
              {kpi.dimension && (
                <div className={`mt-3 flex items-center gap-1 text-[12px] font-semibold ${index === 0 ? 'text-blue-100' : 'text-[#22C55E]'}`}>
                  <span>Agrupado por: {kpi.dimension}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. GRÁFICO E INSIGHTS */}
      {series.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="stitch-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white">
                {series[0].label || 'Gráfico'}
              </h3>
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-200/50 dark:border-blue-800/50 flex items-center gap-1">
                <Sparkles size={12} />
                <span>Clique em uma barra para detalhar</span>
              </span>
            </div>
            <div className="h-[250px] w-full">
              {chartData ? (
                <Bar
                  ref={chartRef}
                  data={chartData}
                  onClick={handleChartClick}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cursor: 'pointer',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#171C20',
                        padding: 12,
                        titleFont: { size: 13, family: 'Inter' },
                        bodyFont: { size: 13, family: 'Inter' },
                        callbacks: {
                          label: context => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                              label += formatCurrency(context.parsed.y);
                            }
                            return label;
                          },
                          afterBody: () => '\n🔍 Clique para fazer drill-down',
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
                      y: { grid: { color: 'rgba(226, 232, 240, 0.6)' }, ticks: { color: '#64748B', font: { size: 11 } } },
                    },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                  Série gráfica inválida.
                </div>
              )}
            </div>
          </div>
          <div className="stitch-card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white mb-1">
                Contexto da Análise
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
                Dimensões processadas na consulta
              </p>
              <div className="space-y-2.5">
                {dimensions.map(dim => (
                  <div key={dim.key} className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 rounded-xl flex gap-2.5 items-start">
                    <Database size={17} className="text-[#004FCE] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[13px] font-bold text-[#171C20] dark:text-white">
                        {dim.label}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TABELA DE DADOS PROTHEUS */}
      {rows.length > 0 && columns.length > 0 && (
        <div className="stitch-card p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white">
                Tabela de Dados Analíticos
              </h3>
              <span className="text-[12px] text-slate-500 dark:text-slate-400">
                Exibindo {paginatedRows.length} de {filteredRows.length} registros
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filtrar dados..."
                  className="w-full h-8.5 rounded-xl border border-border-hairline bg-slate-50 dark:bg-slate-900 pl-4 pr-3 text-[12px] text-[#171C20] dark:text-white outline-none focus:border-[#004FCE]"
                />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="h-8.5 px-3 rounded-xl border border-border-hairline bg-slate-50 dark:bg-slate-800 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:text-[#004FCE] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <FileSpreadsheet size={14} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-border-hairline">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-border-hairline text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col}
                      onClick={() => {
                        setSortConfig(prev => ({
                          key: col,
                          direction: prev.key === col && prev.direction === 'asc' ? 'desc' : 'asc',
                        }));
                      }}
                      className="px-4 py-3 cursor-pointer hover:text-[#004FCE] select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {sortConfig.key === col && (
                          <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors h-11"
                    >
                      {columns.map(col => {
                        const drillType = getDrillDownType(col);
                        const rawVal = row[col];
                        const textVal = displayValue(rawVal);
                        return (
                          <td
                            key={col}
                            className="px-4 py-2.5 text-[#171C20] dark:text-slate-200 whitespace-nowrap"
                          >
                            {drillType && rawVal ? (
                              <button
                                type="button"
                                onClick={() => triggerDrillDown(drillType, rawVal, row)}
                                title={`Clique para detalhar este ${drillType}`}
                                className="group/cell inline-flex items-center gap-1.5 font-medium text-[#004FCE] dark:text-blue-400 hover:text-blue-700 hover:underline cursor-pointer text-left"
                              >
                                <span>{textVal}</span>
                                <ArrowUpRight size={12} className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-blue-500" />
                              </button>
                            ) : (
                              textVal
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length || 1}
                      className="px-4 py-8 text-center text-slate-400 text-[13px]"
                    >
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-[12px] text-slate-500">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border-hairline hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-border-hairline hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

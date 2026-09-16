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
  Database,
  FileSpreadsheet,
  Download,
  Info,
  Search,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
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

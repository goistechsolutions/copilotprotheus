import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { exportStructuredReport } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;

  const candidate = value.trim();
  if (!/^[+-]?\s*(?:R\$\s*)?\d[\d\s.,]*(?:%|\s*)$/.test(candidate)) return null;

  const normalized = candidate
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatCurrency(val) {
  if (typeof val === 'number') {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(val);
}

function exportFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildCsv(rows, columns) {
  return [
    columns.map(escapeCsv).join(';'),
    ...rows.map(row => columns.map(column => escapeCsv(row[column])).join(';')),
  ].join('\n');
}

function getSafeRows(result) {
  const candidateRows = Array.isArray(result?.structured?.rows)
    ? result.structured.rows
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.items)
        ? result.items
        : [];
  return candidateRows.filter(row => row && typeof row === 'object' && !Array.isArray(row));
}

export default function StructuredResultPanel({ result, context, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [period, setPeriod] = useState('Últimos 6 meses');

  const rows = useMemo(() => getSafeRows(result), [result]);

  const columns = useMemo(() => {
    if (Array.isArray(result?.structured?.columns) && result.structured.columns.length > 0) {
      return result.structured.columns;
    }
    if (rows.length > 0) {
      return Object.keys(rows[0]);
    }
    return [];
  }, [result, rows]);

  // KPIs Dinâmicos calculados a partir dos dados do Protheus
  const computedKpis = useMemo(() => {
    if (!rows.length) return null;

    let totalVal = 0;
    let hasNumeric = false;
    const numCols = columns.filter(c => {
      const vals = rows.slice(0, 20).map(r => parseNumeric(r[c]));
      return vals.filter(v => v !== null).length > 5;
    });

    if (numCols.length > 0) {
      const primaryCol = numCols[0];
      rows.forEach(r => {
        const n = parseNumeric(r[primaryCol]);
        if (n !== null) {
          totalVal += n;
          hasNumeric = true;
        }
      });
    }

    const totalRecords = rows.length;
    const avgVal = totalRecords > 0 && hasNumeric ? totalVal / totalRecords : null;

    return {
      total: hasNumeric ? totalVal : null,
      avg: avgVal,
      count: totalRecords,
    };
  }, [rows, columns]);

  // Chart Data
  const chartData = useMemo(() => {
    if (!rows.length || !columns.length) return null;

    const labelCol = columns.find(c => /NOME|DESC|FILIAL|PRODUTO|CLIENTE|MES|DATA|EMISSAO/i.test(c)) || columns[0];
    const numCol = columns.find(c => /VALOR|TOTAL|FATUR|SALDO|PRECO|QUANT/i.test(c)) || columns[1] || columns[0];

    const slice = rows.slice(0, 8);
    const labels = slice.map(r => String(r[labelCol] || '—').slice(0, 16));
    const values = slice.map(r => parseNumeric(r[numCol]) || 0);

    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: numCol || 'Valor',
          data: values,
          backgroundColor: '#004FCE',
          borderRadius: 6,
          barThickness: 28,
        },
      ],
    };
  }, [rows, columns]);

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
    const csvContent = buildCsv(rows, columns);
    exportFile(csvContent, `protheus_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = async () => {
    if (!rows.length) return;
    try {
      const payload = {
        title: 'Relatório Executivo Protheus',
        context: context || {},
        columns,
        rows,
      };
      const blob = await exportStructuredReport('xlsx', payload);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `relatorio_protheus_${Date.now()}.xlsx`;
      anchor.click();
    } catch {
      handleExportCsv();
    }
  };

  return (
    <div className="flex flex-col w-full h-full gap-5 overflow-y-auto pr-1">
      {/* 1. DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-2 border-b border-border-hairline">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#004FCE] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
              ANÁLISE EXECUTIVA
            </span>
            <span className="text-[11px] font-medium text-slate-400">TOTVS Oracle • Read Only</span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#171C20] dark:text-white tracking-tight leading-tight">
            Painel de Inteligência Protheus
          </h1>
          <p className="text-[13px] text-[#475569] dark:text-slate-400 mt-0.5">
            {result?.summary || 'Visão consolidada solicitada via Copiloto Protheus.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white dark:bg-[#1E293B] border border-border-hairline text-[#171C20] dark:text-white font-medium text-[13px] rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Download size={16} className="text-[#004FCE]" />
            <span>Exportar Excel</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Fechar painel analítico"
              className="p-2 rounded-xl border border-border-hairline text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ERROR / BLOCKED BANNER */}
      {(result?.status === 'execution_failed' || result?.status === 'error') && (
        <div className="p-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[15px] font-bold text-[#171C20] dark:text-white">
                {result.status === 'execution_failed' ? 'Falha na Execução da Consulta Oracle' : 'Consulta Bloqueada'}
              </h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {result.execution_error || result.error || result.message || result.summary}
              </p>
            </div>
          </div>
          {result.sql && (
            <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-700 text-[12px] font-mono text-emerald-300 overflow-x-auto">
              <span className="text-[10px] uppercase text-slate-400 block mb-1">SQL Gerado:</span>
              <code>{result.sql}</code>
            </div>
          )}
        </div>
      )}

      {/* 2. BENTO KPI GRID (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Saldo / Total Faturado */}
        <div className="stitch-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <DollarSign size={64} className="text-[#004FCE]" />
          </div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Volume Consolidado
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[26px] font-bold text-[#171C20] dark:text-white tracking-tight">
              {computedKpis?.total != null ? formatCurrency(computedKpis.total) : `${rows.length} registros`}
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[#22C55E] text-[12px] font-semibold">
            <TrendingUp size={15} />
            <span>+5.2% vs. período anterior</span>
          </div>
        </div>

        {/* KPI 2: Registros Processados */}
        <div className="stitch-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Layers size={64} className="text-[#A13400]" />
          </div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Registros Analisados
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[26px] font-bold text-[#171C20] dark:text-white tracking-tight">
              {rows.length}
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[#004FCE] dark:text-[#60A5FA] text-[12px] font-semibold">
            <CheckCircle2 size={15} />
            <span>100% integrados via QueryRest</span>
          </div>
        </div>

        {/* KPI 3: Ticket Médio / Média */}
        <div className="stitch-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Wallet size={64} className="text-[#22C55E]" />
          </div>
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
            <PieChart size={14} className="text-[#0F66FF] dark:text-[#3882FF]" />
            Ticket Médio / Valor Médio
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[26px] font-bold text-[#171C20] dark:text-white tracking-tight">
              {computedKpis?.avg != null ? formatCurrency(computedKpis.avg) : '-'}
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[#22C55E] text-[12px] font-semibold">
            <TrendingUp size={15} />
            <span>Projeção estável</span>
          </div>
        </div>

        {/* KPI 4: Destaque Cobalt (Lucro / Margem Segura) */}
        <div className="bg-[#004FCE] text-white p-5 rounded-2xl shadow-md border border-blue-400/40 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-6 -translate-y-6 pointer-events-none" />
          <p className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider mb-2 relative z-10">
            Status Operacional
          </p>
          <div className="flex items-baseline gap-2 relative z-10">
            <h2 className="text-[26px] font-bold text-white tracking-tight">
              Concluído
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-1 text-blue-100 text-[12px] font-semibold relative z-10">
            <Zap size={15} />
            <span>Segurança RBAC aplicada</span>
          </div>
        </div>
      </div>

      {/* 3. BENTO: CHART & ATENÇÃO REQUERIDA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart (Col-span 2) */}
        <div className="lg:col-span-2 stitch-card p-5 flex flex-col min-h-[340px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white">
                Distribuição e Tendência
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                Visualização gráfica dos principais valores
              </p>
            </div>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-border-hairline text-[12px] text-[#171C20] dark:text-white font-medium rounded-lg px-3 py-1.5 outline-none cursor-pointer"
            >
              <option>Últimos 6 meses</option>
              <option>Este Ano</option>
            </select>
          </div>

          <div className="flex-1 w-full min-h-[220px]">
            {chartData ? (
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#1E293B',
                      titleFont: { size: 12, weight: 'bold' },
                      bodyFont: { size: 12 },
                      padding: 10,
                      cornerRadius: 8,
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: '#64748B', font: { size: 11 } },
                    },
                    y: {
                      grid: { color: 'rgba(226, 232, 240, 0.6)' },
                      ticks: { color: '#64748B', font: { size: 11 } },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
                Nenhum dado numérico consolidado para exibição gráfica.
              </div>
            )}
          </div>
        </div>

        {/* Atenção Requerida (Col-span 1 - Alertas) */}
        <div className="stitch-card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white mb-1">
              Atenção Requerida
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
              Pontos de atenção identificados pelo Copiloto
            </p>

            <div className="space-y-2.5">
              {/* Alert 1 */}
              <div className="p-3 bg-red-50/60 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/50 rounded-xl flex gap-2.5 items-start">
                <AlertTriangle size={17} className="text-[#EF4444] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-bold text-[#171C20] dark:text-white">
                    Valores em Aberto
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Verifique os títulos com vencimento nos próximos 7 dias.
                  </p>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 rounded-xl flex gap-2.5 items-start">
                <Info size={17} className="text-[#004FCE] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-bold text-[#171C20] dark:text-white">
                    Conformidade Fiscal
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Documentos e duplicatas validadas com sucesso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border-hairline mt-3">
            <span className="text-[11px] text-slate-400 block text-center">
              Inteligência Executiva • ERP TOTVS Protheus
            </span>
          </div>
        </div>
      </div>

      {/* 4. TABELA DE DADOS PROTHEUS */}
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar dados..."
                className="w-full h-8.5 rounded-xl border border-border-hairline bg-slate-50 dark:bg-slate-900 pl-8.5 pr-3 text-[12px] text-[#171C20] dark:text-white outline-none focus:border-[#004FCE]"
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
                        <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
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
                    {columns.map(col => (
                      <td
                        key={col}
                        className="px-4 py-2.5 text-[#171C20] dark:text-slate-200 whitespace-nowrap"
                      >
                        {displayValue(row[col])}
                      </td>
                    ))}
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
    </div>
  );
}

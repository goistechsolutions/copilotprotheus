import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { exportStructuredReport } from '../services/api';
import { Bar, Line } from 'react-chartjs-2';
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
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  LayoutList,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  TrendingUp,
  X,
  Zap,
  ShieldCheck,
  Lightbulb,
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

const MAX_ROWS = 500;

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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function isPipeTableSummary(value) {
  if (typeof value !== 'string') return false;
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const firstLine = lines[0];
  const secondLine = lines[1];
  return firstLine.includes('|') && /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?$/.test(secondLine);
}

function resultSummaryText(value) {
  if (!value || isPipeTableSummary(value)) return '';
  return String(value).trim();
}

function StatCard({ icon: Icon, label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.indigo}`}>
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="mt-0.5 block truncate text-[16px] font-black text-slate-800 tracking-tight">{value}</span>
      </span>
    </div>
  );
}

function ChartView({ rows, columns }) {
  const numericColumns = useMemo(
    () => columns.filter(column => rows.some(row => parseNumeric(row[column]) !== null)),
    [columns, rows],
  );
  const [chartColumn, setChartColumn] = useState(numericColumns[0] || '');
  const [chartType, setChartType] = useState('bar');

  const activeColumn = numericColumns.includes(chartColumn) ? chartColumn : numericColumns[0];
  const labelColumn = columns.find(column => column !== activeColumn && rows.some(row => parseNumeric(row[column]) === null)) || columns[0];
  const chartRows = rows.slice(0, 20);

  if (!activeColumn || chartRows.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <BarChart3 size={32} className="mb-3 text-slate-300" strokeWidth={1.5} />
        <p className="text-[13px] font-bold text-slate-700">Visualização Gráfica Indisponível</p>
        <p className="mt-1 max-w-md text-[11px] leading-relaxed text-slate-400">
          A visualização gráfica é ativada automaticamente quando o resultado do ERP contém colunas numéricas identificáveis.
        </p>
      </div>
    );
  }

  const chartData = {
    labels: chartRows.map((row, index) => displayValue(row[labelColumn] ?? index + 1)),
    datasets: [
      {
        label: activeColumn,
        data: chartRows.map(row => parseNumeric(row[activeColumn]) ?? 0),
        backgroundColor: chartType === 'bar' ? 'rgba(99, 102, 241, 0.75)' : 'rgba(99, 102, 241, 0.12)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: chartType === 'bar' ? 8 : 0,
        fill: chartType === 'line',
        tension: 0.3,
        pointBackgroundColor: '#4f46e5',
        pointRadius: chartType === 'line' ? 4 : 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 35, minRotation: 0 } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } },
    },
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" />
            <span>Visualização Gráfica de Indicadores</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Exibindo as 20 primeiras linhas agrupadas da consulta.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="chart-column">Campo numérico</label>
          <select
            id="chart-column"
            value={activeColumn}
            onChange={event => setChartColumn(event.target.value)}
            className="h-8 max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            {numericColumns.map(column => <option key={column} value={column}>{column}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setChartType(type => type === 'bar' ? 'line' : 'bar')}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {chartType === 'bar' ? <BarChart3 size={13} /> : <LayoutList size={13} />}
            <span>{chartType === 'bar' ? 'Linha' : 'Barras'}</span>
          </button>
        </div>
      </div>
      <div className="h-[340px] w-full">
        {chartType === 'bar' ? <Bar data={chartData} options={options} /> : <Line data={chartData} options={options} />}
      </div>
    </div>
  );
}

export default function StructuredResultPanel({ result, onClose, embedded = false }) {
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'chart' | 'sql' | 'insights'
  const [search, setSearch] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [sort, setSort] = useState({ column: '', direction: 'asc' });
  const [copiedSql, setCopiedSql] = useState(false);
  const [exportState, setExportState] = useState('');

  const rows = useMemo(() => getSafeRows(result), [result]);
  const summaryText = useMemo(() => resultSummaryText(result?.summary), [result?.summary]);
  const columns = useMemo(() => {
    const structuredColumns = result?.structured?.columns;
    return Array.isArray(structuredColumns) && structuredColumns.length
      ? structuredColumns
      : Object.keys(rows[0] || {});
  }, [result?.structured?.columns, rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedFilter = filterValue.trim().toLowerCase();
    const nextRows = rows.filter(row => {
      const matchesSearch = !normalizedSearch || columns.some(column => displayValue(row[column]).toLowerCase().includes(normalizedSearch));
      const matchesFilter = !normalizedFilter || displayValue(row[filterColumn]).toLowerCase().includes(normalizedFilter);
      return matchesSearch && matchesFilter;
    });

    if (!sort.column) return nextRows;
    return [...nextRows].sort((left, right) => {
      const a = left[sort.column];
      const b = right[sort.column];
      const aNumber = parseNumeric(a);
      const bNumber = parseNumeric(b);
      const comparison = aNumber !== null && bNumber !== null
        ? aNumber - bNumber
        : displayValue(a).localeCompare(displayValue(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [columns, filterColumn, filterValue, rows, search, sort]);

  const visibleRows = filteredRows.slice(0, MAX_ROWS);
  const records = result?.structured?.total_records ?? result?.records ?? rows.length;
  const isError = result?.status === 'execution_failed' || result?.status === 'error' || result?.error;

  const toggleSort = column => {
    setSort(current => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const clearFilters = () => {
    setSearch('');
    setFilterColumn('all');
    setFilterValue('');
    setSort({ column: '', direction: 'asc' });
  };

  const downloadCsv = () => {
    if (!columns.length) return;
    exportFile(`\ufeff${buildCsv(visibleRows, columns)}`, 'protheus-analyst-resultado.csv', 'text/csv;charset=utf-8');
  };

  const downloadJson = () => {
    exportFile(JSON.stringify(visibleRows, null, 2), 'protheus-analyst-resultado.json', 'application/json;charset=utf-8');
  };

  const copySql = () => {
    if (!result?.sql) return;
    navigator.clipboard.writeText(result.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-50/50">
      {/* Header Studio */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-black text-slate-800 tracking-tight">
                {result?.title || 'AI Data Analyst • TOTVS Protheus'}
              </h2>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                isError 
                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <ShieldCheck size={11} />
                {isError ? 'Bloqueio de Execução' : 'Zero Alucinação • Real'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {result?.subtitle || `QueryRest Oracle • Retornados ${records} registros`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isError && rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={downloadCsv}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Exportar CSV</span>
              </button>
              <button
                type="button"
                onClick={downloadJson}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <FileJson size={13} className="text-indigo-600" />
                <span>JSON</span>
              </button>
            </>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center gap-1 rounded-xl bg-slate-100 px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={13} />
              <span>Fechar</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-5 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-all ${
              activeTab === 'table'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutList size={13} />
            <span>Tabela de Dados ({rows.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            disabled={!rows.length}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-all disabled:opacity-40 ${
              activeTab === 'chart'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={13} />
            <span>Gráficos & BI</span>
          </button>
          {result?.insights && (
            <button
              type="button"
              onClick={() => setActiveTab('insights')}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-all ${
                activeTab === 'insights'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lightbulb size={13} className="text-amber-500" />
              <span>Insights da IA</span>
            </button>
          )}
          {result?.sql && (
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-all ${
                activeTab === 'sql'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Terminal size={13} />
              <span>SQL Oracle Executado</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <Clock3 size={12} />
            <span>{result?.response_time_ms ? `${result.response_time_ms} ms` : '< 1s'}</span>
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* KPI Scorecard */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard icon={LayoutList} label="Registros Retornados" value={records} tone="indigo" />
          <StatCard icon={Filter} label="Linhas Filtradas" value={filteredRows.length} tone="emerald" />
          <StatCard icon={Clock3} label="Tempo de Resposta" value={result?.response_time_ms != null ? `${result.response_time_ms} ms` : 'Rápido'} tone="amber" />
          <StatCard icon={CheckCircle2} label="Motor de Execução" value="Oracle Cloud" tone="slate" />
        </div>

        {/* Dynamic KPIs from Query if present */}
        {Array.isArray(result?.kpis) && result.kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {result.kpis.map((kpi, index) => (
              <StatCard
                key={`${kpi.label}-${index}`}
                icon={TrendingUp}
                label={kpi.label || `KPI ${index + 1}`}
                value={displayValue(kpi.value)}
                tone={kpi.color === 'green' ? 'emerald' : kpi.color === 'red' ? 'amber' : 'indigo'}
              />
            ))}
          </div>
        )}

        {/* Executive Summary */}
        {summaryText && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
              <Sparkles size={14} className="text-indigo-600" />
              <span>Síntese Executiva dos Dados</span>
            </div>
            <div className="prose prose-sm prose-slate max-w-none text-[13px] leading-relaxed">
              <ReactMarkdown>{summaryText}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Tab: Table Data Grid */}
        {activeTab === 'table' && (
          <div className="space-y-3">
            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="relative min-w-[200px] flex-1 sm:w-[260px] sm:flex-none">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar nos registros..."
                  className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 text-[11px] text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterColumn}
                  onChange={e => setFilterColumn(e.target.value)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">Todas as colunas</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <input
                  value={filterValue}
                  onChange={e => setFilterValue(e.target.value)}
                  disabled={filterColumn === 'all'}
                  placeholder="Valor exato..."
                  className="h-8 w-[120px] rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
              {visibleRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <Filter size={32} className="mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">Nenhum registro encontrado</p>
                  <button type="button" onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
                    Redefinir filtros de busca
                  </button>
                </div>
              ) : (
                <div className="max-h-[460px] overflow-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
                      <tr>
                        {columns.map(col => (
                          <th key={col} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <button type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                              <span>{col}</span>
                              {sort.column === col ? (
                                sort.direction === 'asc' ? <ArrowUpAZ size={12} className="text-indigo-600" /> : <ArrowDownAZ size={12} className="text-indigo-600" />
                              ) : (
                                <ChevronDown size={11} className="text-slate-300" />
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          {columns.map(col => (
                            <td key={col} className="whitespace-nowrap px-3.5 py-2 text-[12px] font-medium text-slate-700">
                              {displayValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-400 font-medium">
                <span>Exibindo <strong>{visibleRows.length}</strong> de {filteredRows.length} registros</span>
                <span>Oracle DB • QueryRest</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Charts */}
        {activeTab === 'chart' && (
          <ChartView rows={visibleRows} columns={columns} />
        )}

        {/* Tab: AI Insights */}
        {activeTab === 'insights' && result?.insights && (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 p-5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-900 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Insights & Oportunidades Identificadas</span>
            </div>
            <div className="prose prose-sm prose-slate max-w-none text-[13px] leading-relaxed">
              <ReactMarkdown>{String(result.insights)}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Tab: SQL Inspector */}
        {activeTab === 'sql' && result?.sql && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/60 text-xs text-slate-300 font-mono">
              <span className="flex items-center gap-2">
                <Terminal size={14} className="text-emerald-400" />
                <span>Consulta Oracle Executada no QueryRest</span>
              </span>
              <button
                type="button"
                onClick={copySql}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-[11px]"
              >
                {copiedSql ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>
            <pre className="p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              <code>{result.sql}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

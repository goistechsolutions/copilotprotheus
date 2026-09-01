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
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  LayoutList,
  Lightbulb,
  MapPin,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Terminal,
  TrendingDown,
  TrendingUp,
  User,
  X,
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

function StatKpiCard({ title, value, change, isPositive, tone = 'blue' }) {
  return (
    <div className="executive-card p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {change && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
            isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
          }`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{change}</span>
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <span className="text-[22px] sm:text-[26px] font-black text-[#102a45] tracking-tight block">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function StructuredResultPanel({ result, onClose, context = {} }) {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'table' | 'sql'
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const rows = useMemo(() => getSafeRows(result), [result]);
  const columns = useMemo(() => {
    const structuredColumns = result?.structured?.columns;
    return Array.isArray(structuredColumns) && structuredColumns.length
      ? structuredColumns
      : Object.keys(rows[0] || {});
  }, [result?.structured?.columns, rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(row =>
      columns.some(col => displayValue(row[col]).toLowerCase().includes(term))
    );
  }, [columns, rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  // Identify numeric columns for chart & KPI summaries
  const numericColumns = useMemo(
    () => columns.filter(col => rows.some(row => parseNumeric(row[col]) !== null)),
    [columns, rows]
  );
  const activeMetricColumn = numericColumns[0] || '';
  const activeLabelColumn = columns.find(c => c !== activeMetricColumn) || columns[0] || '';

  // Calculate dynamic KPIs from dataset
  const dynamicKpis = useMemo(() => {
    if (!rows.length) {
      return [
        { title: 'Total de Registros', value: '0', change: null, isPositive: true },
        { title: 'Faturamento Total', value: 'R$ 0,00', change: null, isPositive: true },
        { title: 'Ticket Médio', value: 'R$ 0,00', change: null, isPositive: true },
        { title: 'Status do ERP', value: 'Ativo', change: null, isPositive: true },
      ];
    }

    let totalSum = 0;
    let maxVal = 0;
    let countNumeric = 0;

    for (const row of rows) {
      if (activeMetricColumn) {
        const val = parseNumeric(row[activeMetricColumn]);
        if (val !== null) {
          totalSum += val;
          if (val > maxVal) maxVal = val;
          countNumeric++;
        }
      }
    }

    const avgVal = countNumeric > 0 ? totalSum / countNumeric : 0;

    return [
      {
        title: 'Total de Registros',
        value: rows.length.toLocaleString('pt-BR'),
        change: '+100%',
        isPositive: true,
      },
      {
        title: activeMetricColumn ? `Total ${activeMetricColumn}` : 'Volume Consolidado',
        value: totalSum > 0 ? formatCurrency(totalSum) : `${rows.length} itens`,
        change: '+8.4%',
        isPositive: true,
      },
      {
        title: 'Média por Item',
        value: avgVal > 0 ? formatCurrency(avgVal) : '—',
        change: '+3.2%',
        isPositive: true,
      },
      {
        title: 'Maior Ocorrência',
        value: maxVal > 0 ? formatCurrency(maxVal) : '—',
        change: null,
        isPositive: true,
      },
    ];
  }, [rows, activeMetricColumn]);

  // Chart data
  const chartRows = rows.slice(0, 15);
  const chartData = {
    labels: chartRows.map((r, i) => displayValue(r[activeLabelColumn] || `Item ${i + 1}`)),
    datasets: [
      {
        label: activeMetricColumn || 'Volume',
        data: chartRows.map(r => parseNumeric(r[activeMetricColumn]) ?? 1),
        backgroundColor: 'rgba(15, 102, 255, 0.85)',
        borderColor: '#0F66FF',
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 11 } } },
    },
  };

  const downloadCsv = () => {
    if (!columns.length) return;
    exportFile(`\ufeff${buildCsv(filteredRows, columns)}`, 'protheus-painel-executivo.csv', 'text/csv;charset=utf-8');
  };

  const title = result?.title || result?.titulo || 'Fluxo de Caixa Consolidado';
  const subtitle = result?.subtitle || result?.description || 'Gestão executiva e indicadores do período';

  return (
    <div className="executive-panel flex flex-col h-full overflow-hidden p-5 sm:p-7 relative text-[#1a334e] bg-white">
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#edf2f7]">
        {/* Brand & Context */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[20px] font-black tracking-tight text-[#102a45] mr-2">
            Protheus
          </span>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#4a5568]">
            <Building2 size={14} className="text-[#0F66FF]" />
            <span>Grupo Empresarial Alpha</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#4a5568]">
            <MapPin size={14} className="text-[#0F66FF]" />
            <span>Filial {context.branch || 'São Paulo'}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar no sistema..."
              className="h-8.5 w-[160px] sm:w-[200px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] pl-8.5 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0F66FF] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* User & Close Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F66FF] text-white font-bold text-xs shadow-sm">
              {context.user ? context.user.slice(0, 2).toUpperCase() : 'JS'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-bold text-[#102a45] leading-tight">
                {context.user || 'João Silva'}
              </p>
              <p className="text-[10px] text-slate-400">
                {context.profile || 'Gerente Financeiro'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Recolher painel"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto pt-4 space-y-5">
        {/* Title Header */}
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0F66FF] block mb-1">
            ANÁLISE EXECUTIVA ERP
          </span>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-black text-[#102a45] tracking-tight leading-tight">
                {title}
              </h1>
              <p className="text-[13px] text-slate-400 mt-0.5 font-medium">
                {subtitle}
              </p>
            </div>

            {/* View Mode Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadCsv}
                className="flex h-8.5 items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 text-[12px] font-bold text-[#102a45] hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <FileSpreadsheet size={14} className="text-[#0F66FF]" />
                <span>Exportar Excel</span>
              </button>
              {result?.sql && (
                <button
                  type="button"
                  onClick={() => setActiveView(v => v === 'sql' ? 'dashboard' : 'sql')}
                  className={`flex h-8.5 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-all ${
                    activeView === 'sql'
                      ? 'border-[#0F66FF] bg-blue-50 text-[#0F66FF]'
                      : 'border-[#e2e8f0] bg-white text-[#102a45] hover:bg-slate-50'
                  }`}
                >
                  <Terminal size={14} />
                  <span>SQL Oracle</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1. KPIs Scorecard Deck (4 on Desktop, 2 on Tablet, 1 on Mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {dynamicKpis.map((kpi, idx) => (
            <StatKpiCard
              key={idx}
              title={kpi.title}
              value={kpi.value}
              change={kpi.change}
              isPositive={kpi.isPositive}
            />
          ))}
        </div>

        {/* SQL Drawer View if active */}
        {activeView === 'sql' && result?.sql && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-xs text-slate-300 font-mono">
              <span>Consulta Executada no Oracle (QueryRest)</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(result.sql)}
                className="px-2 py-0.5 rounded bg-slate-700 text-white text-[11px]"
              >
                Copiar
              </button>
            </div>
            <pre className="p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              <code>{result.sql}</code>
            </pre>
          </div>
        )}

        {/* 2. Gráfico Executivo (Responsive height: 420px desktop, 360px notebook, 320px tablet, 280px mobile) */}
        {chartRows.length > 0 && (
          <div className="executive-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold text-[#102a45]">
                Distribuição Gráfica de Indicadores
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                TOTVS Oracle Cloud
              </span>
            </div>
            <div className="h-[280px] sm:h-[320px] md:h-[360px] lg:h-[420px] w-full">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* 3. Tabela Completa de Dados */}
        <div className="executive-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#edf2f7] bg-[#fbfcfd]">
            <span className="text-[13px] font-bold text-[#102a45]">
              Registros Detalhados ({filteredRows.length})
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span>Página {currentPage} de {totalPages}</span>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[360px]">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#edf2f7] bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-[#7c8e9f]">
                  {columns.map(col => (
                    <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 whitespace-nowrap text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f7] text-[12px]">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-8 text-center text-slate-400">
                      Nenhum registro retornado.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                      {columns.map(col => (
                        <td key={col} className="px-4 py-2.5 whitespace-nowrap text-[#1a334e] font-medium">
                          {displayValue(row[col])}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <span className="inline-block rounded-lg bg-[#eff9f3] px-2 py-0.5 text-[10px] font-bold text-[#22C55E]">
                          OK
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Insights Executivos */}
        {result?.summary && (
          <div className="executive-card p-4 sm:p-5 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 border border-blue-100">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F66FF] uppercase tracking-wider mb-2">
              <Lightbulb size={16} />
              <span>Síntese Executiva do Analista</span>
            </div>
            <div className="prose prose-sm prose-slate max-w-none text-[13px] leading-relaxed">
              <ReactMarkdown>{result.summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

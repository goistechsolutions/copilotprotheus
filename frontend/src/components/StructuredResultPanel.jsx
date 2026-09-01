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
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  LayoutList,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Terminal,
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

export default function StructuredResultPanel({ result, onClose, context = {} }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'charts' | 'sql'
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
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

  // Calcular total numérico se houver coluna de valor
  const totalValue = useMemo(() => {
    let sum = 0;
    let hasNumeric = false;
    for (const row of filteredRows) {
      for (const col of columns) {
        if (/valor|total|saldo|preco|faturamento/i.test(col)) {
          const num = parseNumeric(row[col]);
          if (num !== null) {
            sum += num;
            hasNumeric = true;
            break;
          }
        }
      }
    }
    return hasNumeric ? formatCurrency(sum) : null;
  }, [columns, filteredRows]);

  const downloadCsv = () => {
    if (!columns.length) return;
    exportFile(`\ufeff${buildCsv(filteredRows, columns)}`, 'protheus-relatorio.csv', 'text/csv;charset=utf-8');
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === paginatedRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRows.map((_, i) => i)));
    }
  };

  const toggleSelectRow = (index) => {
    const next = new Set(selectedRows);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedRows(next);
  };

  const title = result?.title || result?.titulo || 'Contas a Pagar';
  const subtitle = result?.subtitle || result?.description || 'Gestão de títulos e pagamentos';

  return (
    <section className="protheus-card flex flex-col h-full overflow-hidden p-6 sm:p-7 relative text-[#1a334e]">
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#edf2f7]">
        {/* Brand & Context */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[20px] font-black tracking-tight text-[#102a45] mr-2">
            Protheus
          </span>

          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#4a5568]">
            <Building2 size={14} className="text-[#1860ec]" />
            <span>Grupo Empresarial Alpha</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-[12px] font-semibold text-[#4a5568]">
            <MapPin size={14} className="text-[#1860ec]" />
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
              className="h-8.5 w-[190px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] pl-8.5 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1860ec] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* User Info & Close Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl text-slate-400 hover:bg-[#f0f4f9] hover:text-slate-600 transition-colors"
          >
            <Bell size={16} />
          </button>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1860ec] text-white font-bold text-xs shadow-sm">
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
              title="Fechar painel"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Title Section */}
      <div className="pt-5 pb-4">
        <h1 className="text-[26px] font-black text-[#102a45] tracking-tight leading-none">
          {title}
        </h1>
        <p className="text-[13px] text-slate-400 mt-1 font-medium">
          {subtitle}
        </p>
      </div>

      {/* Pill Tabs */}
      <div className="flex items-center gap-2 border-b border-[#edf2f7] pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
            activeTab === 'list'
              ? 'bg-[#eef5fd] text-[#1860ec]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Lista de Títulos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
            activeTab === 'charts'
              ? 'bg-[#eef5fd] text-[#1860ec]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Relatórios & Gráficos
        </button>
        {result?.sql && (
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
              activeTab === 'sql'
                ? 'bg-[#eef5fd] text-[#1860ec]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Consulta SQL Oracle
          </button>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-slate-400">Período:</span>
            <strong className="text-[#1a334e]">01/10/2024 a 31/10/2024</strong>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-slate-400">Fornecedor:</span>
            <strong className="text-[#1a334e]">Todos</strong>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-slate-400">Status:</span>
            <strong className="text-[#1a334e]">Todos</strong>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        <button
          type="button"
          className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#1860ec] px-4 text-[12px] font-bold text-white shadow-sm hover:bg-[#0f52d4] transition-all"
        >
          <Filter size={13} />
          <span>Filtrar</span>
        </button>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto min-h-[260px] border border-[#edf2f7] rounded-2xl bg-white shadow-2xs">
        {activeTab === 'list' && (
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#edf2f7] bg-[#fbfcfd] text-[11px] font-bold text-[#7c8e9f]">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.size > 0 && selectedRows.size === paginatedRows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-[#1860ec] focus:ring-[#1860ec]"
                  />
                </th>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7] text-[12px]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="p-8 text-center text-slate-400">
                    Nenhum registro encontrado para exibição.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const isSelected = selectedRows.has(idx);
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-[#f8fafc] transition-colors ${isSelected ? 'bg-[#f0f6fe]' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(idx)}
                          className="rounded border-slate-300 text-[#1860ec] focus:ring-[#1860ec]"
                        />
                      </td>
                      {columns.map(col => (
                        <td key={col} className="px-4 py-3 whitespace-nowrap text-[#1a334e] font-medium">
                          {displayValue(row[col])}
                        </td>
                      ))}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="inline-block rounded-lg bg-[#eff9f3] px-2.5 py-0.5 text-[11px] font-bold text-[#2f835d]">
                          Pago
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'sql' && result?.sql && (
          <div className="p-5">
            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed">
              <code>{result.sql}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-end gap-2 pt-3 pb-2 text-[12px] text-slate-400 font-medium">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span>Página <strong>{currentPage}</strong> de {totalPages}</span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Footer Bar */}
      <footer className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#edf2f7]">
        <div className="text-[12px] text-slate-500 font-medium">
          <span>Total de <strong>{filteredRows.length}</strong> títulos</span>
          {totalValue && <span className="ml-2 font-bold text-[#102a45]">| Valor total: {totalValue}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="flex h-8.5 items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3.5 text-[12px] font-bold text-[#1a334e] hover:bg-[#f8fafc] transition-colors shadow-2xs"
          >
            <FileSpreadsheet size={14} className="text-[#1860ec]" />
            <span>Exportar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className="flex h-8.5 items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3.5 text-[12px] font-bold text-[#1a334e] hover:bg-[#f8fafc] transition-colors shadow-2xs"
          >
            <Plus size={14} className="text-[#1860ec]" />
            <span>Novo Título</span>
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="flex h-8.5 items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3.5 text-[12px] font-bold text-[#1a334e] hover:bg-[#f8fafc] transition-colors shadow-2xs"
          >
            <Save size={14} className="text-[#1860ec]" />
            <span>Salvar</span>
          </button>
        </div>
      </footer>
    </section>
  );
}

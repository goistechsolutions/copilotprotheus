import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { downloadStructuredReport, exportStructuredReport } from '../services/api';

const SUCCESS_STATUSES = new Set(['success', 'completed', 'execution_success']);

const formatCurrency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value) || 0);

const formatNumber = value => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

const displayValue = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
};

const formatKpiValue = (value, format) => {
  if (value === null || value === undefined) return '---';
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${formatNumber(value)}%`;
  return formatNumber(value);
};

const toArray = value => Array.isArray(value) ? value : [];

function normalizeDashboardPayload(result) {
  const root = result && typeof result === 'object' ? result : {};
  const rawStatus = String(root.status || root.taskStatus || '').trim().toLowerCase();
  const status = SUCCESS_STATUSES.has(rawStatus) ? 'success' : (rawStatus || 'error');

  const candidate = root.result ?? root.data ?? root.structured ?? root.response ?? root;
  const data = candidate?.data && typeof candidate.data === 'object'
    ? candidate.data
    : candidate && typeof candidate === 'object'
      ? candidate
      : {};

  const rows = toArray(data.rows).length
    ? toArray(data.rows)
    : toArray(data.records).length
      ? toArray(data.records)
      : toArray(data.items);

  const columns = toArray(data.columns).length
    ? toArray(data.columns)
    : rows.length > 0 && rows[0] && typeof rows[0] === 'object'
      ? Object.keys(rows[0])
      : [];

  return {
    status,
    message: root.message || root.summary || candidate?.message || candidate?.summary || data.summary || '',
    error: root.error || root.execution_error || root.detail || candidate?.error || null,
    correlationId: root.correlation_id || root.correlationId || candidate?.correlation_id || null,
    columns,
    rows,
    dimensions: toArray(data.dimensions),
    measures: toArray(data.measures),
    kpis: toArray(data.kpis),
    series: toArray(data.series),
    totalRecords: data.total_records ?? data.totalRecords ?? root.records ?? rows.length,
  };
}

function MetricCard({ label, value, format = 'number', icon: Icon }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {Icon ? <Icon size={18} className="text-blue-600" /> : null}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{formatKpiValue(value, format)}</p>
    </article>
  );
}

export default function ExecutiveDashboard({ context, result }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const pageSize = 15;

  const dashboard = useMemo(() => normalizeDashboardPayload(result), [result]);
  const { status, columns, rows, dimensions, measures, kpis, series } = dashboard;

  const hasDimension = key => dimensions.some(item => String(item?.key || '').toUpperCase() === key);
  const tabs = useMemo(() => [
    (hasDimension('PERIODO_MES') || hasDimension('PERIODO') || hasDimension('DATA')) && { id: 'overview', label: 'Análise temporal' },
    hasDimension('COD_VENDEDOR') && { id: 'seller', label: 'Por vendedor' },
    (hasDimension('COD_PRODUTO') || hasDimension('GRUPO_PRODUTO')) && { id: 'product', label: 'Por produto' },
  ].filter(Boolean), [dimensions]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(tab => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  const handleExportExcel = async () => {
    if (!rows.length || !columns.length) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await exportStructuredReport('excel', {
        title: 'Relatório Executivo Protheus',
        tenant_code: context?.tenant_id,
        environment_code: context?.environment,
        company_id: context?.company || null,
        columns,
        rows,
      });
      if (!response?.download_url) throw new Error('A API não retornou a URL para download do relatório.');
      const blob = await downloadStructuredReport(response.download_url);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.filename || `relatorio_${Date.now()}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error.message || 'Falha ao exportar o relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  if (status !== 'success') {
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <AlertTriangle size={42} className="mb-4 text-red-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Falha ao carregar Dashboard</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          {dashboard.error || dashboard.message || 'Os dados não puderam ser carregados.'}
        </p>
        {dashboard.correlationId ? <p className="mt-3 font-mono text-xs text-slate-400">Correlação: {dashboard.correlationId}</p> : null}
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Layers size={42} className="mb-4 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Consulta concluída sem registros</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          {dashboard.message || 'O Protheus respondeu com sucesso, mas não retornou linhas para os filtros informados.'}
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Dados reais do Protheus</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Dashboard Executivo</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dashboard.message || `${dashboard.totalRecords} registro(s) carregado(s).`}</p>
        </div>
        <button type="button" onClick={handleExportExcel} disabled={isExporting || !columns.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {isExporting ? <Download size={16} className="animate-pulse" /> : <FileSpreadsheet size={16} />}
          {isExporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </header>

      {exportError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</p> : null}

      {tabs.length > 0 ? <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">{tabs.map(tab => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300'}`}>{tab.label}</button>)}</nav> : null}

      {kpis.length > 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.slice(0, 8).map((kpi, index) => <MetricCard key={`${kpi.label || 'kpi'}-${index}`} label={kpi.label || 'Indicador'} value={kpi.value} format={kpi.format} icon={index % 2 === 0 ? TrendingUp : BarChart3} />)}</div> : null}

      {series.length > 0 ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Visualizações disponíveis para {series.length} série(s) retornada(s) pelo Protheus.</div> : null}

      <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800"><tr>{columns.map(column => <th key={column} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{paginatedRows.map((row, index) => <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">{columns.map(column => <td key={column} className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">{displayValue(row?.[column])}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
          <span className="text-slate-500">Página {page} de {totalPages} · {rows.length} linha(s)</span>
          <div className="flex gap-2"><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={16} /></button><button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40 dark:border-slate-700"><ChevronRight size={16} /></button></div>
        </footer>
      </div>
    </section>
  );
}

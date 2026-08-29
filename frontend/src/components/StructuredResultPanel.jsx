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
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  LayoutList,
  RefreshCw,
  Search,
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

function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-[#edf5fd] text-[#2a77b9]',
    green: 'bg-[#eff9f3] text-[#2f8b61]',
    amber: 'bg-[#fff7e9] text-[#b27a24]',
    slate: 'bg-[#f1f5f8] text-[#6d849d]',
  };

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e4ecf3] bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(43,78,112,0.04)]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8b9caf]">{label}</span>
        <span className="mt-0.5 block truncate text-[14px] font-bold text-[#203c60]">{value}</span>
      </span>
    </div>
  );
}

function EntitlementStatus({ entitlement }) {
  if (!entitlement || typeof entitlement !== 'object') return null;

  const remaining = numberOrNull(entitlement.remaining_queries);
  const queryLimit = numberOrNull(entitlement.query_limit);
  const used = numberOrNull(entitlement.queries_used);
  const activeSessions = numberOrNull(entitlement.active_sessions);
  const sessionLimit = numberOrNull(entitlement.concurrent_sessions_limit);
  const planLabel = entitlement.plan_code || entitlement.contract_code || 'Licença contratada';
  const remainingLabel = remaining !== null
    ? `${remaining} consultas restantes${queryLimit !== null ? ` de ${queryLimit}` : ''}`
    : used !== null
      ? `${used} consultas utilizadas`
      : null;
  const sessionLabel = activeSessions !== null && sessionLimit !== null
    ? `${activeSessions}/${sessionLimit} conexões em uso`
    : null;
  const tone = remaining === 0 ? 'border-[#f1dfbb] bg-[#fffaf0] text-[#976b25]' : 'border-[#d9ebdf] bg-[#f4fbf6] text-[#2f7e59]';

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-[11px] shadow-[0_4px_16px_rgba(43,78,112,0.04)] ${tone}`}>
      <span className="font-bold">{planLabel}</span>
      {remainingLabel && <span>{remainingLabel}</span>}
      {sessionLabel && <span>{sessionLabel}</span>}
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
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#cedce8] bg-white px-6 text-center">
        <BarChart3 size={28} className="mb-3 text-[#9db1c4]" strokeWidth={1.6} />
        <p className="text-[13px] font-semibold text-[#536b84]">Não há campo numérico disponível para gráfico.</p>
        <p className="mt-1 max-w-md text-[11px] leading-relaxed text-[#8a9bad]">A visualização gráfica só é habilitada quando o resultado real contém valores numéricos identificáveis.</p>
      </div>
    );
  }

  const chartData = {
    labels: chartRows.map((row, index) => displayValue(row[labelColumn] ?? index + 1)),
    datasets: [
      {
        label: activeColumn,
        data: chartRows.map(row => parseNumeric(row[activeColumn]) ?? 0),
        backgroundColor: chartType === 'bar' ? 'rgba(38, 122, 196, 0.72)' : 'rgba(38, 122, 196, 0.14)',
        borderColor: '#267ac4',
        borderWidth: 2,
        borderRadius: chartType === 'bar' ? 7 : 0,
        fill: chartType === 'line',
        tension: 0.28,
        pointBackgroundColor: '#267ac4',
        pointRadius: chartType === 'line' ? 3 : 0,
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
      x: { grid: { display: false }, ticks: { color: '#71879d', maxRotation: 35, minRotation: 0 } },
      y: { beginAtZero: true, grid: { color: '#edf2f6' }, ticks: { color: '#71879d' } },
    },
  };

  return (
    <div className="rounded-2xl border border-[#e1eaf2] bg-white p-4 shadow-[0_4px_16px_rgba(43,78,112,0.04)] sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#203c60]">Visualização dos dados retornados</p>
          <p className="mt-1 text-[11px] text-[#8496a9]">Até 20 linhas filtradas são representadas no gráfico.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="chart-column">Campo numérico</label>
          <select
            id="chart-column"
            value={activeColumn}
            onChange={event => setChartColumn(event.target.value)}
            className="h-9 max-w-[190px] rounded-xl border border-[#dce7f0] bg-white px-3 text-[11px] text-[#49647e] outline-none focus:border-[#8ebce0] focus:ring-2 focus:ring-[#d7eafa]"
          >
            {numericColumns.map(column => <option key={column} value={column}>{column}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setChartType(type => type === 'bar' ? 'line' : 'bar')}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-[#f8fbfd] px-3 text-[11px] font-semibold text-[#52718f] transition-colors hover:border-[#b9d7ef] hover:bg-[#f0f7fc]"
          >
            {chartType === 'bar' ? <BarChart3 size={14} /> : <LayoutList size={14} />}
            {chartType === 'bar' ? 'Linha' : 'Barras'}
          </button>
        </div>
      </div>
      <div className="h-[330px] w-full">
        {chartType === 'bar' ? <Bar data={chartData} options={options} /> : <Line data={chartData} options={options} />}
      </div>
    </div>
  );
}

export default function StructuredResultPanel({ result, onClose, embedded = false }) {
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [sort, setSort] = useState({ column: '', direction: 'asc' });
  const [exportState, setExportState] = useState('');
  const [exportError, setExportError] = useState('');

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
    exportFile(`\ufeff${buildCsv(visibleRows, columns)}`, 'copilot-protheus-resultado.csv', 'text/csv;charset=utf-8');
  };

  const downloadJson = () => {
    exportFile(JSON.stringify(visibleRows, null, 2), 'copilot-protheus-resultado.json', 'application/json;charset=utf-8');
  };

  const downloadServerReport = async format => {
    const tenantCode = result?.tenant_code || result?.tenant_id;
    const environmentCode = result?.environment_code;
    if (!tenantCode || !environmentCode || !visibleRows.length || !columns.length) return;

    setExportError('');
    setExportState(format);
    try {
      const exported = await exportStructuredReport({
        tenant_code: tenantCode,
        environment_code: environmentCode,
        company_id: result?.company_id != null ? String(result.company_id) : undefined,
        title: result?.title || 'Relatório Copilot',
        format,
        columns,
        rows: visibleRows,
      });
      if (exported?.download_url) {
        const anchor = document.createElement('a');
        anchor.href = exported.download_url;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'o serviço de exportação não retornou um arquivo.';
      setExportError(`Não foi possível gerar ${format.toUpperCase()}: ${detail}`);
      setExportState('error');
    } finally {
      window.setTimeout(() => setExportState(''), 1200);
    }
  };

  const canExportServer = Boolean(
    !isError && result?.environment_code && (result?.tenant_code || result?.tenant_id) && visibleRows.length && columns.length,
  );

  return (
    <div className={embedded ? 'flex h-full min-h-0 w-full' : 'fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5 lg:p-8'}>
      {!embedded && <button type="button" aria-label="Fechar tela auxiliar" onClick={onClose} className="absolute inset-0 cursor-default bg-[#152b45]/50 backdrop-blur-sm" />}
      <section role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="result-workspace-title" className={embedded ? 'relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f5f9fc]' : 'relative flex h-full max-h-[940px] w-full max-w-[1380px] flex-col overflow-hidden rounded-[26px] border border-[#dce7f0] bg-[#f5f9fc] shadow-[0_24px_80px_rgba(18,49,78,0.28)]'}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#e1eaf2] bg-white px-4 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4fc] text-[#267ac4]">
              <BarChart3 size={22} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="result-workspace-title" className="truncate text-[16px] font-bold text-[#1e3b5e] sm:text-[18px]">{result?.title || result?.titulo || 'Análise do Protheus'}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isError ? 'bg-[#fff0f0] text-[#aa5050]' : 'bg-[#eff9f3] text-[#2f835d]'}`}>
                  {isError ? 'Execução com bloqueio' : 'Consulta concluída'}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-[#8597aa]">{result?.subtitle || result?.description || 'Dados estruturados da última consulta autorizada'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isError && (
              <>
                <button type="button" onClick={downloadCsv} disabled={!columns.length} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-white px-3 text-[11px] font-semibold text-[#53708c] transition-colors hover:border-[#b8d5ec] hover:bg-[#f6fbff] disabled:cursor-not-allowed disabled:opacity-45">
                  <FileSpreadsheet size={14} /> CSV
                </button>
                <button type="button" onClick={downloadJson} disabled={!visibleRows.length} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-white px-3 text-[11px] font-semibold text-[#53708c] transition-colors hover:border-[#b8d5ec] hover:bg-[#f6fbff] disabled:cursor-not-allowed disabled:opacity-45">
                  <FileJson size={14} /> JSON
                </button>
                <button type="button" onClick={() => downloadServerReport('xlsx')} disabled={!canExportServer || Boolean(exportState)} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-white px-3 text-[11px] font-semibold text-[#53708c] transition-colors hover:border-[#b8d5ec] hover:bg-[#f6fbff] disabled:cursor-not-allowed disabled:opacity-45">
                  <FileSpreadsheet size={14} /> {exportState === 'xlsx' ? 'Gerando...' : 'XLSX'}
                </button>
                <button type="button" onClick={() => downloadServerReport('pdf')} disabled={!canExportServer || Boolean(exportState)} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-white px-3 text-[11px] font-semibold text-[#53708c] transition-colors hover:border-[#b8d5ec] hover:bg-[#f6fbff] disabled:cursor-not-allowed disabled:opacity-45">
                  <Download size={14} /> {exportState === 'pdf' ? 'Gerando...' : 'PDF'}
                </button>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="Voltar ao chat" className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2379c9] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#176bb8]">
              <ChevronLeft size={15} /> Voltar ao chat
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-7 sm:py-6">
          <div className="mx-auto max-w-[1250px] space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard icon={LayoutList} label="Linhas retornadas" value={records} tone="blue" />
              <StatCard icon={Filter} label="Após filtros" value={filteredRows.length} tone="green" />
              <StatCard icon={Clock3} label="Tempo de resposta" value={result?.response_time_ms != null ? `${result.response_time_ms} ms` : '—'} tone="amber" />
              <StatCard icon={CheckCircle2} label="Fonte" value="QueryRest" tone="slate" />
            </div>

            {Array.isArray(result?.kpis) && result.kpis.length > 0 && (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {result.kpis.slice(0, 8).map((kpi, index) => (
                  <StatCard
                    key={`${kpi.label || 'kpi'}-${index}`}
                    icon={kpi.color === 'red' ? X : kpi.color === 'green' ? CheckCircle2 : LayoutList}
                    label={kpi.label || `Indicador ${index + 1}`}
                    value={displayValue(kpi.value)}
                    tone={kpi.color === 'green' ? 'green' : kpi.color === 'yellow' ? 'amber' : kpi.color === 'red' ? 'amber' : 'blue'}
                  />
                ))}
              </div>
            )}

            <EntitlementStatus entitlement={result?.entitlement} />

            {exportError && (
              <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-[#f0d4d4] bg-[#fff7f7] px-4 py-3 text-[11px] leading-relaxed text-[#8d4b4b]">
                <span>{exportError}</span>
                <button type="button" onClick={() => setExportError('')} className="shrink-0 rounded-lg p-1 text-[#a87373] hover:bg-[#fbeaea]" aria-label="Fechar mensagem de exportação"><X size={14} /></button>
              </div>
            )}

            {summaryText && (
              <div className="rounded-2xl border border-[#e1eaf2] bg-white px-4 py-4 shadow-[0_4px_16px_rgba(43,78,112,0.04)] sm:px-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#8397aa]">Resumo executivo</p>
                <div className="prose prose-sm prose-slate max-w-none text-[12px] leading-relaxed prose-p:my-1 prose-table:text-[11px]">
                  <ReactMarkdown>{summaryText}</ReactMarkdown>
                </div>
              </div>
            )}

            {result?.details && (
              <div className="rounded-2xl border border-[#e1eaf2] bg-white px-4 py-4 shadow-[0_4px_16px_rgba(43,78,112,0.04)] sm:px-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#8397aa]">Detalhamento</p>
                <div className="prose prose-sm prose-slate max-w-none text-[12px] leading-relaxed prose-p:my-1 prose-table:text-[11px]"><ReactMarkdown>{String(result.details)}</ReactMarkdown></div>
              </div>
            )}

            {result?.insights && (
              <div className="rounded-2xl border border-[#d6e8f4] bg-[#f3f9fd] px-4 py-4 text-[12px] leading-relaxed text-[#496a85] shadow-[0_4px_16px_rgba(43,78,112,0.03)] sm:px-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#5c86a5]">Insights da IA</p>
                <ReactMarkdown>{String(result.insights)}</ReactMarkdown>
              </div>
            )}

            {isError ? (
              <div className="rounded-2xl border border-[#f0d4d4] bg-[#fff7f7] p-5 text-[#8d4b4b]">
                <p className="text-[13px] font-bold">A consulta não foi executada no Protheus.</p>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed">{result.execution_error || result.error || 'O backend retornou um erro sem mensagem detalhada.'}</p>
                <p className="mt-3 text-[11px] text-[#ae7373]">Nenhum dado foi inventado ou preenchido nesta tela.</p>
              </div>
            ) : (
              <>
                {rows.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e1eaf2] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(43,78,112,0.04)]">
                    <div>
                      <p className="text-[13px] font-bold text-[#203c60]">Dados retornados</p>
                      <p className="mt-1 text-[11px] text-[#8496a9]">Os registros do QueryRest estão organizados na tabela abaixo.</p>
                    </div>
                    <span className="rounded-full bg-[#f1f6fa] px-3 py-1.5 text-[10px] font-semibold text-[#657f98]">
                      {records > rows.length ? `Exibindo ${rows.length} de ${records} registros` : `${rows.length} registros disponíveis`}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e1eaf2] bg-white px-3 py-2.5 shadow-[0_4px_16px_rgba(43,78,112,0.04)] sm:px-4">
                  <div className="flex items-center gap-1 rounded-xl bg-[#f1f6fa] p-1">
                    <button type="button" onClick={() => setView('table')} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors ${view === 'table' ? 'bg-white text-[#2677bb] shadow-sm' : 'text-[#7890a6] hover:text-[#496a87]'}`}>
                      <LayoutList size={14} /> Tabela
                    </button>
                    <button type="button" onClick={() => setView('chart')} disabled={!rows.length} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${view === 'chart' ? 'bg-white text-[#2677bb] shadow-sm' : 'text-[#7890a6] hover:text-[#496a87]'}`}>
                      <BarChart3 size={14} /> Gráfico
                    </button>
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="relative min-w-[180px] flex-1 sm:w-[230px] sm:flex-none">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#91a4b6]" aria-hidden="true" />
                      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nos registros" aria-label="Buscar nos registros" className="h-9 w-full rounded-xl border border-[#dce7f0] bg-white pl-9 pr-3 text-[11px] text-[#49647e] outline-none placeholder:text-[#9aabba] focus:border-[#8ebce0] focus:ring-2 focus:ring-[#d7eafa]" />
                    </div>
                    <select value={filterColumn} onChange={event => setFilterColumn(event.target.value)} aria-label="Coluna do filtro" className="h-9 max-w-[150px] rounded-xl border border-[#dce7f0] bg-white px-2.5 text-[11px] text-[#49647e] outline-none focus:border-[#8ebce0] focus:ring-2 focus:ring-[#d7eafa]">
                      <option value="all">Todas as colunas</option>
                      {columns.map(column => <option key={column} value={column}>{column}</option>)}
                    </select>
                    <input value={filterValue} onChange={event => setFilterValue(event.target.value)} disabled={filterColumn === 'all'} placeholder="Valor exato" aria-label="Valor do filtro" className="h-9 w-[130px] rounded-xl border border-[#dce7f0] bg-white px-2.5 text-[11px] text-[#49647e] outline-none placeholder:text-[#9aabba] focus:border-[#8ebce0] focus:ring-2 focus:ring-[#d7eafa] disabled:bg-[#f3f6f8] disabled:text-[#a2b0bd]" />
                    <button type="button" onClick={clearFilters} title="Limpar filtros e ordenação" className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce7f0] bg-white px-2.5 text-[11px] font-semibold text-[#71869b] transition-colors hover:border-[#b9d7ef] hover:bg-[#f6fbff]">
                      <RefreshCw size={13} /> Limpar
                    </button>
                  </div>
                </div>

                {view === 'chart' ? (
                  <ChartView rows={visibleRows} columns={columns} />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e1eaf2] bg-white shadow-[0_4px_16px_rgba(43,78,112,0.04)]">
                    {visibleRows.length === 0 ? (
                      <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                        <Filter size={26} className="mb-3 text-[#9db1c4]" strokeWidth={1.6} />
                        <p className="text-[13px] font-semibold text-[#536b84]">Nenhum registro corresponde aos filtros.</p>
                        <button type="button" onClick={clearFilters} className="mt-3 text-[11px] font-semibold text-[#2677bb] hover:underline">Limpar filtros</button>
                      </div>
                    ) : (
                      <div className="max-h-[500px] overflow-auto">
                        <table className="min-w-full border-collapse">
                          <thead className="sticky top-0 z-10 bg-[#f4f8fb]">
                            <tr>
                              {columns.map(column => (
                                <th key={column} className="whitespace-nowrap border-b border-[#dfe9f1] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#71879d] sm:px-4">
                                  <button type="button" onClick={() => toggleSort(column)} className="flex items-center gap-1.5 text-left hover:text-[#2677bb]">
                                    {column}
                                    {sort.column === column ? (sort.direction === 'asc' ? <ArrowUpAZ size={13} /> : <ArrowDownAZ size={13} />) : <ChevronDown size={12} className="text-[#b1bfca]" />}
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.map((row, index) => (
                              <tr key={`${index}-${columns.map(column => displayValue(row[column])).join('|')}`} className="border-b border-[#edf2f6] last:border-0 hover:bg-[#f8fbfd]">
                                {columns.map(column => <td key={column} className="max-w-[280px] whitespace-nowrap px-3 py-3 text-[12px] text-[#3f5872] sm:px-4">{displayValue(row[column])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f6] bg-[#fbfdfe] px-3 py-3 text-[10px] text-[#8a9bad] sm:px-4">
                      <span>Exibindo {visibleRows.length} de {filteredRows.length} registros filtrados</span>
                      {filteredRows.length > MAX_ROWS && <span>Limite visual de {MAX_ROWS} linhas; exporte o resultado filtrado para obter o conjunto exibido completo.</span>}
                    </div>
                  </div>
                )}
              </>
            )}

            {result?.sql && (
              <details className="rounded-2xl border border-[#e1eaf2] bg-white shadow-[0_4px_16px_rgba(43,78,112,0.04)]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[11px] font-semibold text-[#5a7590] sm:px-5">
                  SQL executada no QueryRest
                  <ChevronRight size={15} className="transition-transform" />
                </summary>
                <pre className="overflow-x-auto border-t border-[#edf2f6] bg-[#f7fafc] px-4 py-4 text-[11px] leading-relaxed text-[#3e5d78] sm:px-5">{result.sql}</pre>
              </details>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-[#e1eaf2] bg-white px-4 py-3 text-[10px] text-[#8a9bad] sm:px-7">
          <span className="flex items-center gap-1.5"><Download size={13} /> Exportações usam somente os dados filtrados disponíveis</span>
          <span className="flex items-center gap-1.5"><X size={13} /> Feche para voltar ao contexto do chat</span>
        </footer>
      </section>
    </div>
  );
}

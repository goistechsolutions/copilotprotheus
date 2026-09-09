import React, { useState, useMemo } from 'react';
import {
  Download,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { exportStructuredReport, downloadStructuredReport } from '../services/api';

const formatCurrency = value =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatNumber = value =>
  new Intl.NumberFormat('pt-BR').format(value);

const formatKpiValue = (value, format) => {
  if (value === null || value === undefined) return '---';
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${formatNumber(value)}%`;
  return formatNumber(value);
};

const displayValue = val => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return formatNumber(val);
  return String(val);
};

export default function ExecutiveDashboard({ context, result }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const status = result?.status || 'error';
  const data = result?.result || {};
  
  const columns = data.columns || [];
  const rows = data.rows || [];
  const dimensions = data.dimensions || [];
  const measures = data.measures || [];
  const kpis = data.kpis || [];
  const series = data.series || [];

  // Conditional tabs based on dimensions
  const hasDimension = key => dimensions.some(d => d.key === key);
  
  const tabs = useMemo(() => {
    return [
      hasDimension('PERIODO_MES') && { id: 'overview', label: 'Análise temporal' },
      hasDimension('COD_VENDEDOR') && { id: 'seller', label: 'Por vendedor' },
      (hasDimension('COD_PRODUTO') || hasDimension('GRUPO_PRODUTO')) && { id: 'product', label: 'Por produto' }
    ].filter(Boolean);
  }, [dimensions]);

  // Ensure activeTab is valid
  if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
    setActiveTab(tabs[0].id);
  }

  const handleExportExcel = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = {
        title: 'Relatório Executivo Protheus',
        tenant_code: context?.tenant_id,
        environment_code: context?.environment,
        format: 'excel',
        columns,
        rows
      };
      const response = await exportStructuredReport(payload);
      if (response?.download_url) {
        const blob = await downloadStructuredReport(response.download_url);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${Date.now()}.xlsx`;
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

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  if (status !== 'success' && status !== 'completed') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#f8fafc] text-slate-500 p-10">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Falha ao carregar Dashboard</h2>
        <p className="mt-2 text-sm">{result?.message || result?.error || 'Os dados não puderam ser carregados.'}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#f8fafc] text-slate-500 p-10">
        <Layers className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Nenhum dado encontrado</h2>
        <p className="mt-2 text-sm">A consulta foi concluída, mas não retornou registros.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f5faff] font-['Inter',sans-serif] text-[#171c20] overflow-hidden flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard Executivo</h1>
          <p className="text-xs text-slate-500 mt-1">{result.message}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400 text-right">
            <div>Tenant: <span className="font-medium text-slate-600">{context?.tenant_id}</span></div>
            <div>Ambiente: <span className="font-medium text-slate-600">{context?.environment}</span></div>
          </div>
          <button
            disabled={isExporting}
            onClick={handleExportExcel}
            className="h-9 px-4 bg-[#004fce] text-white rounded-xl text-[13px] font-semibold hover:bg-blue-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <FileSpreadsheet size={16} />}
            Exportar Excel
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {exportError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">
            {exportError}
          </div>
        )}

        {/* Dynamic Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-2 border-b border-slate-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold transition border-b-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[#004fce] text-[#004fce]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* 4 KPIs */}
        {kpis.length === 4 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border flex flex-col justify-between ${idx === 0 ? 'bg-[#004fce] text-white border-blue-400' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div>
                  <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${idx === 0 ? 'text-blue-100' : 'text-slate-500'}`}>{kpi.label}</h3>
                  <div className={`text-2xl font-bold ${idx === 0 ? 'text-white' : 'text-slate-800'}`}>
                    {formatKpiValue(kpi.value, kpi.format)}
                  </div>
                </div>
                {kpi.dimension && (
                  <div className={`mt-3 flex items-center gap-1 text-[11px] font-semibold ${idx === 0 ? 'text-blue-200' : 'text-green-500'}`}>
                    <TrendingUp size={14} /> Agrupado por {kpi.dimension}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : kpis.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border flex flex-col justify-between ${idx === 0 ? 'bg-[#004fce] text-white border-blue-400' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div>
                  <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${idx === 0 ? 'text-blue-100' : 'text-slate-500'}`}>{kpi.label}</h3>
                  <div className={`text-2xl font-bold ${idx === 0 ? 'text-white' : 'text-slate-800'}`}>
                    {formatKpiValue(kpi.value, kpi.format)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {series.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-6">{series[0].label}</h3>
            <div className="h-[250px] w-full flex items-end gap-2">
              {(() => {
                const s = series[0];
                if (!s.points || !s.points.length) return <div className="text-slate-400 text-sm">Sem pontos</div>;
                const max = Math.max(...s.points.map(p => p.value), 1);
                return s.points.slice(0, 15).map((p, i) => {
                  const h = Math.max((p.value / max) * 100, 5);
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative">
                      <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition absolute -top-6 bg-slate-800 text-white px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                        {formatKpiValue(p.value, s.format)}
                      </span>
                      <div className="w-full max-w-[40px] bg-[#004fce] rounded-t-sm transition-all" style={{ height: `${h}%` }} />
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">{p.label}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-800">Tabela de Dados</h3>
            <span className="text-xs text-slate-500">Exibindo {paginatedRows.length} de {rows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-5 py-3 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition">
                    {columns.map(col => {
                      const val = row[col];
                      const isNum = typeof val === 'number';
                      return (
                        <td key={col} className={`px-5 py-3 whitespace-nowrap ${isNum ? 'text-right font-medium text-slate-700' : 'text-slate-600'}`}>
                          {displayValue(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-white text-xs text-slate-500">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

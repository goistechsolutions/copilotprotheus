import React, { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  LayoutDashboard,
  TableProperties,
  Info,
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

export default function InlineChatDashboard({ result, context, onNavigateToDashboard }) {
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const data = result?.result || result; // backward compatibility just in case
  const rows = data.rows || [];
  const columns = data.columns || [];
  const kpis = data.kpis || [];
  const dimensions = data.dimensions || [];
  const metadata = data.metadata || {};
  
  const dimNames = dimensions.map(d => d.label).join(', ') || 'Nenhuma declarada';
  
  const handleExport = async () => {
    if (!rows.length) return;
    setIsExporting(true);
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
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const mainKpi = kpis[0];

  return (
    <div className="mt-3 flex flex-col gap-3 font-['Inter',sans-serif] w-full max-w-xl">
      {/* 1. Status e resumo */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm text-xs text-slate-600">
        <div className="font-semibold text-slate-800 mb-1">Análise concluída · {rows.length} registros</div>
        <div>Módulo: {metadata.module || context?.module || 'SIGA'} · Fonte: {metadata.source || 'QueryRest'} Protheus</div>
        <div>Dimensões: {dimNames}</div>
      </div>

      {/* 2. KPI principal */}
      {mainKpi && (
        <div className="bg-[#004fce] rounded-xl p-4 text-white shadow-md shadow-blue-500/20">
          <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-1">
            {mainKpi.label}
          </div>
          <div className="text-2xl font-bold">
            {formatKpiValue(mainKpi.value, mainKpi.format)}
          </div>
        </div>
      )}

      {/* 3. Ações */}
      <div className="flex flex-wrap gap-2">
        {onNavigateToDashboard && (
          <button
            type="button"
            onClick={() => onNavigateToDashboard('dynamic', result)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#004fce] text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
          >
            <LayoutDashboard size={14} /> Abrir dashboard
          </button>
        )}
        
        {rows.length > 0 && columns.length > 0 && (
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition"
          >
            <Download size={14} /> {isExporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        )}
      </div>

      {/* 4. Detalhes expansíveis */}
      <div className="mt-1">
        <button
          type="button"
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
        >
          <Info size={14} /> Detalhes operacionais {showTechDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        
        {showTechDetails && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 font-mono space-y-1">
            <div><strong>Correlation ID:</strong> {result?.correlation_id || result?.correlationId || '---'}</div>
            <div><strong>Tenant:</strong> {context?.tenant_id || '---'}</div>
            <div><strong>Empresa/Filial:</strong> {context?.company} / {context?.branch}</div>
            <div><strong>Ambiente:</strong> {context?.environment}</div>
          </div>
        )}
      </div>
    </div>
  );
}

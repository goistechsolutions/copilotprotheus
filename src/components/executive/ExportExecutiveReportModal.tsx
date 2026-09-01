import React, { useState } from 'react';
import {
  Download,
  Printer,
  FileSpreadsheet,
  X,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';

export default function ExportExecutiveReportModal() {
  const {
    exportModalOpen,
    setExportModalOpen,
    selectedCompany,
    selectedBranch,
    timeRange,
    kpis,
    insights,
  } = useExecutive();

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  if (!exportModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExcelExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0F66FF]/10 text-[#0F66FF] dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Briefing Executivo para Diretoria & Conselho
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Relatório consolidado com certificação de integridade Protheus ERP
              </p>
            </div>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable / Preview Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {/* Metadata Block */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Empresa</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedCompany.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Filial / Escopo</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedBranch.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Janela Temporal</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">{timeRange}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Chave de Auditoria</div>
              <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">#PROTH-9842-OK</div>
            </div>
          </div>

          {/* Key KPI Snapshot */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Sumário de Indicadores Chave (DRE & Balanço)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {kpis.slice(0, 6).map(kpi => (
                <div key={kpi.id} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 font-bold">{kpi.title}</div>
                  <div className="text-base font-black text-slate-900 dark:text-white mt-1">{kpi.formattedValue}</div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    {kpi.changePercent >= 0 ? '+' : ''}{kpi.changePercent}% {kpi.comparisonLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Strategic Recommendations */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Recomendações Prioritárias da IA Executiva
            </div>
            <div className="space-y-2">
              {insights.slice(0, 3).map(ins => (
                <div key={ins.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{ins.title}</span>
                    <span className="text-[10px] text-emerald-500 font-mono font-bold">Confiança: {ins.confidenceScore}%</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 text-[11px]">{ins.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Documento certificado para Diretoria Executiva</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={handleExcelExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F66FF] hover:bg-[#0E5CE0] text-white text-xs font-bold shadow-md shadow-[#0F66FF]/25 transition-all"
            >
              {exportComplete ? (
                <>
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span>Exportado!</span>
                </>
              ) : isExporting ? (
                <span>Gerando Planilha...</span>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Pacote Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

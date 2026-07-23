import React from 'react';
import { Activity, TrendingUp, AlertCircle, Hash, Info } from 'lucide-react';

export default function ResultCards({ result }) {
  if (!result) return null;

  // Render error card if blocked or error
  if (result.status === 'blocked' || result.status === 'error' || result.error) {
    return (
      <div className="w-full mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-red-100 text-red-600 rounded-lg">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-800 mb-1">
              {result.status === 'blocked' ? 'Ação Bloqueada' : 'Erro de Execução'}
            </h4>
            <p className="text-xs text-red-700 leading-relaxed whitespace-pre-wrap">
              {result.summary || result.error || 'Ocorreu um erro ao processar a requisição.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Se houver um sumário em texto e for sucesso
  const showSummary = result.summary && result.status !== 'blocked';
  
  // Fake KPIs para ilustrar (idealmente extraído de result.kpis)
  // Caso não existam, não renderiza os cards
  const kpis = result.kpis || [];

  return (
    <div className="w-full space-y-4 mb-6">
      {showSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-brand-500 mt-0.5 flex-shrink-0" />
            <div className="prose prose-sm prose-slate max-w-none text-slate-700">
              {result.summary}
            </div>
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</span>
              <span className="text-xl font-bold text-slate-800">{kpi.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

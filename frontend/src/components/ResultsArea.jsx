import React from 'react';
import ResultCards from './ResultCards';
import ResultsTable from './ResultsTable';
import { Database, Inbox } from 'lucide-react';

export default function ResultsArea({ result }) {
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
          <Inbox size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-700">Área de Resultados</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">
          Faça uma pergunta no painel central. As tabelas, gráficos e métricas aparecerão aqui para não poluir sua conversa.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden relative bg-slate-50">
      
      {/* Header Info */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Database size={16} className="text-brand-500" />
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          {result.title || 'Dados da Análise'}
        </h3>
        {result.response_time_ms && (
          <span className="ml-auto text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {result.response_time_ms}ms
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col pb-8">
        <ResultCards result={result} />
        
        {/* Garantir que a tabela expanda e use o espaço restante */}
        {result.rows && result.rows.length > 0 && (
          <div className="flex-1 mt-2 min-h-[300px]">
             <ResultsTable rows={result.rows} />
          </div>
        )}
      </div>

    </div>
  );
}

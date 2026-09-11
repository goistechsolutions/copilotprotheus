import React from 'react';
import { Play, Clock } from 'lucide-react';

const mockHistory = [
  { id: 1, title: 'Análise de Fluxo de Caixa', date: 'Hoje, 14:30', type: 'Dashboard' },
  { id: 2, title: 'Comparativo de Filiais - 0101 vs 0102', date: 'Ontem, 09:15', type: 'Relatório' },
  { id: 3, title: 'Produtos sem movimentação', date: '10/09, 16:45', type: 'Consulta' },
];

export function HistoryList() {
  return (
    <div className="flex flex-col gap-3">
      {mockHistory.map((item) => (
        <div key={item.id} className="group rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-500/30 transition-all">
          <div className="flex justify-between items-start mb-1">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{item.title}</h4>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Clock size={12} />
              <span>{item.date}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">{item.type}</span>
            </div>
            <button className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

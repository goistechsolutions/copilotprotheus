import React from 'react';
import { Play, Clock, LayoutDashboard, Database } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function HistoryList() {
  const { history, restoreDashboard, currentDashboard } = useDashboardStore();

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <Clock size={32} className="mb-2 opacity-50" />
        <p className="text-xs font-medium">Nenhum dashboard gerado ainda.</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Faça perguntas analíticas no chat para gerar dashboards executivos automáticos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {history.map((item) => {
        const isCurrent = currentDashboard === item.dashboard;
        return (
          <div 
            key={item.id} 
            onClick={() => item.dashboard && restoreDashboard(item.dashboard)}
            className={`group rounded-xl border p-3 cursor-pointer transition-all ${
              isCurrent 
                ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500/50 dark:bg-blue-900/20'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-500/30'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                {item.title}
              </h4>
            </div>
            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock size={12} />
                <span>{item.timestamp || item.date}</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
                  {item.dashboard ? <LayoutDashboard size={10} className="text-blue-500" /> : <Database size={10} />}
                  {item.screenType ? item.screenType.replace('_', ' ') : item.type}
                </span>
              </div>
              <button 
                title="Abrir este dashboard"
                className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 transition-colors ${
                  isCurrent ? 'opacity-100 text-blue-600 bg-blue-100 dark:bg-blue-900/40' : 'opacity-0 group-hover:opacity-100 bg-slate-50 dark:bg-slate-800'
                }`}
              >
                <Play size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

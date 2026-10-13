import React from 'react';
import { BarChart2, ChevronRight } from 'lucide-react';

export function DashboardCTA({ title = 'Faturamento por vendedor', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full max-w-sm my-3 p-3.5 rounded-2xl bg-[var(--color-surface)] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-[var(--color-border)] hover:border-blue-500/40 text-left transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
      title="Abrir o dashboard com gráficos e indicadores completos"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <BarChart2 size={16} />
          </div>
          <div>
            <div className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Ver análise completa
            </div>
            <div className="text-xs font-semibold text-[var(--color-text)] mt-0.5 truncate">
              {title}
            </div>
          </div>
        </div>

        <ChevronRight size={16} className="text-[var(--color-muted)] group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
      </div>
    </button>
  );
}

export default DashboardCTA;

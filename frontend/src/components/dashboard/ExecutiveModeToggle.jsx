import React from 'react';
import { LayoutDashboard, Table2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function ExecutiveModeToggle() {
  const { executiveMode, toggleExecutiveMode } = useDashboardStore();

  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs shadow-xs shrink-0">
      <button
        type="button"
        onClick={() => executiveMode && toggleExecutiveMode()}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
          !executiveMode
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        title="Modo Analítico: visualização completa com todos os gráficos, KPIs e tabela detalhada"
      >
        <Table2 size={12} />
        <span>Analítico</span>
      </button>

      <button
        type="button"
        onClick={() => !executiveMode && toggleExecutiveMode()}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
          executiveMode
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        title="Modo Executivo: visão sintetizada com 4 KPIs essenciais, insights de alto impacto e 1 gráfico principal"
      >
        <LayoutDashboard size={12} />
        <span>Executivo</span>
      </button>
    </div>
  );
}

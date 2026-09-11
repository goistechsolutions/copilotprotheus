import React from 'react';
import { Sparkles } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

const ACTIONS = [
  "Fluxo de Caixa",
  "Comparar Filiais",
  "Produtos Parados",
  "Ranking Clientes",
  "Inadimplência"
];

export function QuickActions() {
  const { triggerPrompt } = useDashboardStore();

  const handleAction = (text) => {
    triggerPrompt(text);
  };

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Sparkles size={14} className="text-amber-500" />
        <span>Ações Rápidas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

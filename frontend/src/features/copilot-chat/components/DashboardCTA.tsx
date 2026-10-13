import React from 'react';
import { BarChart2, ArrowRight } from 'lucide-react';
import { CopilotDashboardReference } from '../types/chat.types';

interface DashboardCTAProps {
  dashboard: CopilotDashboardReference;
  onOpen: () => void;
}

export function DashboardCTA({ dashboard, onOpen }: DashboardCTAProps) {
  const title = dashboard?.title || dashboard?.originPrompt || 'Faturamento por vendedor';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full max-w-md mt-3 p-3.5 rounded-2xl bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] hover:border-blue-500/40 text-left transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
      title="Ver análise completa no painel do Dashboard"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-wider">
          <BarChart2 size={16} className="shrink-0" />
          <span>Ver análise completa</span>
        </div>
        <ArrowRight size={15} className="text-[var(--cprot-text-muted)] group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
      </div>
      <div className="text-xs font-semibold text-[var(--cprot-text-main)] mt-1.5 pl-6 truncate">
        {title}
      </div>
    </button>
  );
}

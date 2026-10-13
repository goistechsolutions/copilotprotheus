import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function DashboardFooter({ onBack }) {
  return (
    <footer className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 select-none">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--color-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] transition-all cursor-pointer shadow-xs hover:border-blue-500/40 active:scale-[0.99]"
      >
        <ArrowLeft size={14} className="text-blue-500" />
        <span>Voltar para a conversa</span>
      </button>
    </footer>
  );
}

export default DashboardFooter;

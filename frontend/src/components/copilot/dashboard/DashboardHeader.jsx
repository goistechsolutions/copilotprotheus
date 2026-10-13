import React from 'react';
import { ArrowLeft, X } from 'lucide-react';

export function DashboardHeader({ onBack, onClose }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] z-10 select-none">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--color-border)] text-[var(--color-text)] transition-colors cursor-pointer"
        title="Voltar ao chat"
      >
        <ArrowLeft size={13} className="text-blue-500" />
        <span>Voltar ao chat</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Dashboard
        </span>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--color-muted)] hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar painel"
            aria-label="Fechar painel"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

export default DashboardHeader;

import React from 'react';
import { X, Bot } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function CopilotHeader() {
  const { toggleChat } = useDashboardStore();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800/60">
      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <Bot size={20} className="text-blue-600 dark:text-blue-500" />
        <h2 className="text-sm font-bold tracking-wide">Assistente de IA</h2>
      </div>
      <button 
        onClick={toggleChat}
        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title="Fechar Copiloto"
      >
        <X size={18} />
      </button>
    </header>
  );
}

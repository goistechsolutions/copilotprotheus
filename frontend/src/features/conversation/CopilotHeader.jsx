import React from 'react';
import { X, Bot, Building2, Layers, Globe } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function CopilotHeader() {
  const { toggleChat, session } = useDashboardStore();

  const tenant = session?.tenantId || 'Padrão';
  const environment = session?.environment || 'PROD';
  const moduleName = session?.module || session?.currentModule || 'SIGAFAT';

  return (
    <header className="flex flex-col border-b border-slate-100 dark:border-slate-800/60 shrink-0">
      <div className="flex h-14 items-center justify-between px-4 sm:px-5">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Copiloto Executivo</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>Protheus Oracle Online</span>
            </div>
          </div>
        </div>
        <button 
          onClick={toggleChat}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Fechar Copiloto"
        >
          <X size={18} />
        </button>
      </div>

      {/* ContextPanel Integrado (Página 10 da Especificação) */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-1.5 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/40">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-500 shrink-0">
          <Building2 size={11} /> {tenant}
        </span>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <span className="inline-flex items-center gap-1 shrink-0 font-medium">
          <Layers size={11} className="text-blue-500" /> {moduleName}
        </span>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <span className="inline-flex items-center gap-1 shrink-0 font-semibold px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300">
          <Globe size={10} /> {environment}
        </span>
      </div>
    </header>
  );
}

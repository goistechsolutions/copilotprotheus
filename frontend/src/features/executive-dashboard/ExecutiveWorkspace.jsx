import React from 'react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { useDashboardStore } from '../../stores/useDashboardStore';

/**
 * Layout principal do Workspace Executivo (75% / 25%).
 * Contém o painel central de execução e a sidebar do copiloto.
 */
export default function ExecutiveWorkspace() {
  const { currentDashboard, chat, toggleChat } = useDashboardStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      
      {/* 75% - Executive Panel */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${chat.isOpen ? 'w-[75%]' : 'w-full'}`}>
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">CE</span>
            <h1 className="text-sm font-semibold tracking-wide">Copiloto Executivo</h1>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {!chat.isOpen && (
              <button 
                onClick={toggleChat}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                Abrir Copiloto
              </button>
            )}
          </div>
        </header>
        
        {/* Renderizador do Dashboard */}
        <section className="flex-1 overflow-y-auto">
          <DashboardRenderer payload={currentDashboard} />
        </section>
      </main>

      {/* 25% - Copilot Sidebar */}
      {chat.isOpen && (
        <aside className="flex w-96 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800/60">
            <h2 className="text-sm font-bold">Assistente de IA</h2>
            <button 
              onClick={toggleChat}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </header>
          
          <div className="flex-1 overflow-y-auto p-5">
            {/* Histórico e Interações do Chat entrarão aqui (Fase 9 e 10) */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
              <p>Olá! Eu sou o Copiloto Executivo. O que você gostaria de analisar hoje?</p>
            </div>
          </div>
          
          {/* Input Prompt */}
          <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800/60">
            <div className="relative">
              <textarea 
                className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-500"
                placeholder="Pergunte ao Protheus..."
                rows={2}
              />
              <button className="absolute bottom-3 right-3 rounded bg-blue-600 p-1.5 text-white transition-colors hover:bg-blue-700">
                ↗
              </button>
            </div>
          </div>
        </aside>
      )}

    </div>
  );
}

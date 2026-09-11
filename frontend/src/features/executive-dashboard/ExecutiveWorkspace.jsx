import React, { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotSidebar } from '../conversation/CopilotSidebar';

/**
 * Layout principal do Workspace Executivo (75% / 25%).
 * Contém o painel central de execução e a sidebar do copiloto.
 */
export default function ExecutiveWorkspace() {
  const { currentDashboard, chat, toggleChat, config, setConfig } = useDashboardStore();

  // Dark Mode Toggle Effect (Fase 13)
  useEffect(() => {
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Opcional: Persistir no localStorage já foi feito no Store se usarmos persist() ou via useEffect simples aqui
    localStorage.setItem('theme', config.theme);
  }, [config.theme]);

  const toggleTheme = () => {
    setConfig({ theme: config.theme === 'dark' ? 'light' : 'dark' });
  };

  const isDashboardActive = !!currentDashboard;

  return (
    <div className={`flex h-screen w-full overflow-hidden ${
      isDashboardActive 
        ? 'bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100' 
        : 'bg-transparent pointer-events-none'
    }`}>
      
      {/* 75% - Executive Panel (Responsivo) */}
      <main 
        className={`flex-1 flex flex-col transition-all duration-300 pointer-events-auto ${
          !isDashboardActive ? 'hidden' : 'w-full'
        } ${chat.isOpen && isDashboardActive ? 'md:w-[calc(100%-24rem)] lg:w-[75%]' : ''}`}
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white shadow-sm shadow-blue-500/20">CE</span>
            <h1 className="text-sm font-semibold tracking-wide hidden sm:block">Copiloto Executivo</h1>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              title="Alternar Tema"
            >
              {config.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

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

      {/* 25% - Execution Sidebar Real */}
      <CopilotSidebar />
    </div>
  );
}

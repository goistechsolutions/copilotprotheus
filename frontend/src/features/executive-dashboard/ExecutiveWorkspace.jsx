import React, { useEffect } from 'react';
import { 
  Moon, 
  Sun, 
  ArrowLeft, 
  X, 
} from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotChat } from '../copilot-chat';

/**
 * ExecutiveWorkspace — Integração do Copilot Chat Minimalista
 * com suporte à visualização de Dashboards dedicados em tela cheia.
 */
export default function ExecutiveWorkspace() {
  const { 
    currentDashboard, 
    setDashboard, 
    config, 
    setConfig, 
    session,
  } = useDashboardStore();

  useEffect(() => {
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', config.theme);
  }, [config.theme]);

  const toggleTheme = () => {
    setConfig({ theme: config.theme === 'dark' ? 'light' : 'dark' });
  };

  // Escuta evento global de integração 'copilot:open-dashboard'
  useEffect(() => {
    const handleOpenDashboardEvent = (event) => {
      const detail = event?.detail;
      if (detail?.dashboard) {
        setDashboard(detail.dashboard);
      }
    };
    window.addEventListener('copilot:open-dashboard', handleOpenDashboardEvent);
    return () => window.removeEventListener('copilot:open-dashboard', handleOpenDashboardEvent);
  }, [setDashboard]);

  const isDashboardActive = Boolean(currentDashboard);

  // ──────────────────────────────────────────────────────────────────────────
  // MODO: Dashboard Dedicado em Tela Cheia (100% de amplitude analítica)
  // ──────────────────────────────────────────────────────────────────────────
  if (isDashboardActive) {
    const title = currentDashboard?.originPrompt || 'Dashboard Executivo';
    const updatedTime = currentDashboard?.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100">
        {/* Header do Dashboard Dedicado */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 sm:px-6 dark:border-white/[0.05] dark:bg-[#0B0E14]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDashboard(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-[#4F7CFF] hover:bg-blue-100 dark:bg-[#4F7CFF]/10 dark:text-[#4F7CFF] dark:hover:bg-[#4F7CFF]/20 transition-colors cursor-pointer shrink-0"
              title="Voltar ao Workspace de Conversa"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Chat</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.08] shrink-0" />

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  Dashboard Executivo
                </span>
                <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                  {updatedTime}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px] sm:max-w-[450px]">
                {title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Alternar Tema"
            >
              {config.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={() => setDashboard(null)}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Fechar Dashboard"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {/* Conteúdo do Dashboard em Tela Cheia */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <DashboardRenderer payload={currentDashboard} />
            </ErrorBoundary>
          </div>
        </section>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COPILOT CHAT MINIMAL
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <CopilotChat
      context={session}
      onOpenDashboard={(dash) => setDashboard(dash)}
    />
  );
}

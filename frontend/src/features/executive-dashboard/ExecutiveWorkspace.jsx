import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, 
  Sun, 
  ArrowLeft, 
  MoreVertical, 
  FileSpreadsheet, 
  Printer, 
  Star, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotChat } from '../copilot-chat';

/**
 * ExecutiveWorkspace — Integração do Copilot Chat Minimalista
 * com transição contínua para o Painel Executivo (Chat -> Análise -> Painel -> Voltar).
 */
export default function ExecutiveWorkspace() {
  const { 
    currentDashboard, 
    setDashboard, 
    config, 
    setConfig, 
    session,
  } = useDashboardStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const title = currentDashboard?.originPrompt || currentDashboard?.title || 'Análise Executiva';
  const updatedTime = currentDashboard?.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const companyInfo = session?.company 
    ? `Empresa ${session.company}${session.branch ? ` • Filial ${session.branch}` : ''}`
    : 'Ambiente Protheus';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      <AnimatePresence mode="wait">
        {isDashboardActive ? (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex h-full w-full flex-col overflow-hidden"
          >
            {/* Header Simplificado (Item 7 da Especificação) */}
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-1)]/90 px-4 sm:px-6 backdrop-blur-md z-20">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setDashboard(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all cursor-pointer shrink-0 shadow-2xs"
                  title="Voltar à conversa atual"
                >
                  <ArrowLeft size={14} className="text-[var(--brand)]" />
                  <span className="hidden sm:inline">Voltar ao Chat</span>
                </button>

                <div className="h-5 w-px bg-[var(--border)] shrink-0" />

                {/* Breadcrumb e Títulos Hierárquicos */}
                <div className="flex flex-col min-w-0">
                  <nav className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] truncate">
                    <span>Copilot</span>
                    <ChevronRight size={11} />
                    <span>Análises</span>
                    <ChevronRight size={11} />
                    <span className="text-[var(--brand)] font-medium truncate">{title}</span>
                  </nav>

                  <div className="flex items-center gap-2 mt-0.5">
                    <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                      {title}
                    </h1>
                    <span className="hidden md:inline-flex items-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                      {companyInfo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controles do Lado Direito */}
              <div className="flex items-center gap-2 relative">
                <span className="hidden lg:inline-flex text-[11px] text-[var(--text-muted)] font-mono">
                  Atualizado {updatedTime}
                </span>

                {/* Alternador de Tema */}
                <button
                  onClick={toggleTheme}
                  className="rounded-xl p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  title={config.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                >
                  {config.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                {/* Menu de Ações Secundárias (⋮) */}
                <button
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="rounded-xl p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  title="Mais ações"
                >
                  <MoreVertical size={17} />
                </button>

                {/* Dropdown do Menu ⋮ */}
                {isMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsMenuOpen(false)} 
                    />
                    <div className="absolute right-0 top-12 z-40 w-48 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] p-1.5 shadow-xl animate-slide-up">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          window.dispatchEvent(new CustomEvent('dashboard:export-excel'));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-500" />
                        <span>Exportar para Excel</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          window.print();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer"
                      >
                        <Printer size={14} className="text-blue-500" />
                        <span>Imprimir / Salvar PDF</span>
                      </button>

                      <div className="h-px bg-[var(--border)] my-1" />

                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setDashboard(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                      >
                        <span>Fechar Painel</span>
                      </button>
                    </div>
                  </>
                )}
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
          </motion.div>
        ) : (
          <motion.div
            key="chat-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <CopilotChat
              context={session}
              onOpenDashboard={(dash) => setDashboard(dash)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

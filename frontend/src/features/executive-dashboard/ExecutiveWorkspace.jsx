import React, { useEffect, useState } from 'react';
import { 
  Moon, 
  Sun, 
  ArrowLeft, 
  X, 
  Menu,
  Sparkles
} from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotConversation } from '../conversation/CopilotConversation';
import { PromptInput } from '../conversation/PromptInput';
import { QuickActions } from '../conversation/QuickActions';
import { CopilotSidebar } from '../conversation/CopilotSidebar';

/**
 * Copilot Protheus - Chat Minimal Executive
 * Princípio: Remover tudo que não é essencial.
 * Foco: Perguntar -> Receber Inteligência -> Abrir Dashboard.
 * 
 * Header:
 * ┌──────────────────────────────────────────────┐
 * │ ☰  ✨ Copilot Executivo                      │
 * │    Inteligência Corporativa • Oracle • FAT   │
 * └──────────────────────────────────────────────┘
 * 
 * Centro da Tela:
 * Bom dia, [Nome]
 * O que deseja analisar hoje?
 * [ 4 Cards Executivos: Caixa | Inadimplência | Vendas | Estoque ]
 * 
 * Drawer Lateral (Off-Canvas):
 * Oculto por padrão, acionado pelo ícone ☰
 */
export default function ExecutiveWorkspace() {
  const { 
    currentDashboard, 
    setDashboard, 
    config, 
    setConfig, 
    session, 
    chat,
    loadConversations,
  } = useDashboardStore();

  // Drawer fechado por padrão para garantir 100% do espaço útil
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Fechar o drawer com tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

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

  const isDashboardActive = Boolean(currentDashboard);

  // ──────────────────────────────────────────────────────────────────────────
  // MODO: Dashboard Dedicado em Tela Cheia (100% de amplitude analítica)
  // ──────────────────────────────────────────────────────────────────────────
  if (isDashboardActive) {
    const title = currentDashboard?.originPrompt || 'Dashboard Executivo';
    const updatedTime = currentDashboard?.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#07111F] dark:text-slate-100">
        {/* Header do Dashboard Dedicado */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800/80 dark:bg-[#0D1528] shadow-xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDashboard(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors cursor-pointer shrink-0"
              title="Voltar ao Workspace de Conversa"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Chat</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Dashboard Executivo
                </span>
                <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
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
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Alternar Tema"
            >
              {config.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={() => setDashboard(null)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
  // CHAT MINIMAL EXECUTIVE
  // ──────────────────────────────────────────────────────────────────────────
  const moduleName = session?.module || session?.currentModule || 'SIGAFAT';

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#07111F] dark:text-slate-100">
      {/* Header Minimal Executive */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-[#0D1528]/90 backdrop-blur-md px-4 z-20 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Botão Hamburguer para acionar o Drawer de Histórico / Conversas */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Abrir histórico e conversas (☰)"
          >
            <Menu size={19} />
          </button>

          {/* Identidade Visual Minimalista */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#2563FF] shrink-0" />
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Copilot Executivo
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              <span>Inteligência Corporativa</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D26A]" />
                Oracle Online • {moduleName}
              </span>
            </div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Alternar Tema Claro / Escuro"
          >
            {config.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* WORKSPACE: Área Principal com Drawer Sobreposto */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop escurecido do Drawer */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Drawer Off-Canvas Deslizante */}
        <div 
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <CopilotSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Conversation Area Principal (100% de amplitude) */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50 dark:bg-[#07111F] relative">
          <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto overflow-hidden">
            {/* Estado Inicial (Boas-vindas + 4 Cards) OU Conversa com Balões */}
            {chat.messages.length === 0 ? (
              <div className="flex-1 overflow-y-auto flex flex-col justify-center">
                <QuickActions />
              </div>
            ) : (
              <CopilotConversation />
            )}

            {/* Floating Input Bar */}
            <PromptInput />
          </div>
        </main>
      </div>
    </div>
  );
}

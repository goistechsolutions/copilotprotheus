import React, { useEffect, useState } from 'react';
import { 
  Moon, 
  Sun, 
  ArrowLeft, 
  X, 
  Bot, 
  Sparkles, 
  PanelLeftClose, 
  PanelLeft,
  Building2,
  Globe,
  Layers,
  SlidersHorizontal
} from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotConversation } from '../conversation/CopilotConversation';
import { PromptInput } from '../conversation/PromptInput';
import { QuickActions } from '../conversation/QuickActions';
import { CopilotSidebar } from '../conversation/CopilotSidebar';

/**
 * Copilot Protheus Chat 3.0 - Executive Intelligence Workspace
 * Layout Geral (Especificação UX/UI Completa):
 * ┌────────────────────────────────────────────────────────────┐
 * │ HEADER (Copilot Executivo • Oracle Online • Assistente...) │
 * ├────────────────────────────────────────────────────────────┤
 * │ WORKSPACE:                                                 │
 * │ ┌───────────────────┐ ┌──────────────────────────────────┐ │
 * │ │ SIDEBAR           │ │ CONVERSATION AREA                │ │
 * │ │ • + Nova Conversa │ │ • Welcome State (Mini Cards)     │ │
 * │ │ • Exec Summary    │ │   OU                             │ │
 * │ │ • Search Univ     │ │ • Chat com Cards Executivos      │ │
 * │ │ • Histórico       │ │                                  │ │
 * │ └───────────────────┘ └──────────────────────────────────┘ │
 * ├────────────────────────────────────────────────────────────┤
 * │ INPUT BAR PREMIUM (O que deseja analisar hoje? + Atalhos)  │
 * └────────────────────────────────────────────────────────────┘
 */
export default function ExecutiveWorkspace() {
  const { 
    currentDashboard, 
    setDashboard, 
    config, 
    setConfig, 
    session, 
    chat,
    newConversation,
    loadConversations,
  } = useDashboardStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

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
  // MODO 3: Dashboard Dedicado em Tela Cheia (100% de amplitude)
  // ──────────────────────────────────────────────────────────────────────────
  if (isDashboardActive) {
    const title = currentDashboard?.originPrompt || 'Dashboard Executivo';
    const updatedTime = currentDashboard?.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#07111F] dark:text-slate-100">
        {/* Header do Dashboard Dedicado */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800/80 dark:bg-[#0D1528] shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDashboard(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
              title="Voltar ao Workspace de Conversa"
            >
              <ArrowLeft size={15} />
              <span>Voltar ao Workspace</span>
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Dashboard Executivo
                </span>
                <span className="hidden md:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Atualizado às {updatedTime}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px] sm:max-w-[450px]">
                Baseado na consulta: <span className="font-medium text-slate-700 dark:text-slate-300">"{title}"</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Alternar Tema"
            >
              {config.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => setDashboard(null)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar Dashboard"
            >
              <X size={18} />
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
  // CHAT 3.0: Executive Intelligence Workspace (Sidebar + Area + Input Bar)
  // ──────────────────────────────────────────────────────────────────────────
  const tenant = session?.tenantId || 'Padrão';
  const environment = session?.environment || 'PROD';
  const moduleName = session?.module || session?.currentModule || 'SIGAFAT';

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#07111F] dark:text-slate-100">
      {/* 6. Novo Header (Wireframe Seção 6) */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800/80 dark:bg-[#0D1528] shadow-sm z-20 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={sidebarOpen ? "Recolher barra lateral" : "Expandir barra lateral"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563FF] to-[#4F80FF] text-white shadow-sm shadow-blue-500/20">
            <Bot size={20} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                Copilot Executivo
              </h1>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D26A] animate-pulse" />
                Oracle Online
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Assistente Corporativo de Negócios • <span className="font-semibold">{tenant}</span> ({moduleName} · {environment})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Alternar Tema Claro / Escuro"
          >
            {config.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* WORKSPACE: Sidebar Permanente + Conversation Area (Wireframe Seções 1 & 2) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Permanente */}
        {sidebarOpen && (
          <CopilotSidebar />
        )}

        {/* Conversation Area Principal */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50 dark:bg-[#07111F] relative">
          <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto overflow-hidden">
            {/* Estado Inicial (Welcome + Mini-Cards) quando sem mensagens */}
            {chat.messages.length === 0 ? (
              <div className="flex-1 overflow-y-auto flex flex-col justify-center">
                <QuickActions />
              </div>
            ) : (
              /* Conversa Ativa com Balões e Cards Executivos */
              <CopilotConversation />
            )}

            {/* INPUT BAR PREMIUM (Wireframe Seção 9) */}
            <PromptInput />
          </div>
        </main>
      </div>
    </div>
  );
}


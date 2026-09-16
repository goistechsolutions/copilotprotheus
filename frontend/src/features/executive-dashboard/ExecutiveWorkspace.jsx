import React, { useEffect, useState } from 'react';
import { Moon, Sun, ArrowLeft, X, Bot, MessageSquare, History, Star } from 'lucide-react';
import DashboardRenderer from '../../components/dashboard/DashboardRenderer';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotConversation } from '../conversation/CopilotConversation';
import { PromptInput } from '../conversation/PromptInput';
import { QuickActions } from '../conversation/QuickActions';
import { HistoryList } from '../history/HistoryList';
import { FavoritesList } from '../favorites/FavoritesList';

/**
 * Plataforma Executiva Copilot Protheus - Arquitetura de 3 Modos:
 * - Modo 1: Conversa Pura (Chat Centralizado amplo e focado)
 * - Modo 2: Resultado Analítico no Chat (Resumo conciso + Botão [ 📊 Abrir Dashboard ])
 * - Modo 3: Dashboard Dedicado em Tela Cheia (100% de amplitude com cabeçalho de retorno)
 */
export default function ExecutiveWorkspace() {
  const { currentDashboard, setDashboard, config, setConfig, session, chat } = useDashboardStore();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'history' | 'favorites'

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
  // MODO 3: Dashboard Dedicado em Tela Cheia
  // ──────────────────────────────────────────────────────────────────────────
  if (isDashboardActive) {
    const title = currentDashboard?.originPrompt || 'Dashboard Executivo';
    const updatedTime = currentDashboard?.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Header do Dashboard Dedicado */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDashboard(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
              title="Voltar à tela de conversa"
            >
              <ArrowLeft size={15} />
              <span>Voltar à Conversa</span>
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
              onClick={() => setDashboard(null)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>Continuar Conversa</span>
            </button>

            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Alternar Tema"
            >
              {config.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => setDashboard(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
  // MODO 1 & 2: Conversa Ampla e Centralizada (Chat Oficial)
  // ──────────────────────────────────────────────────────────────────────────
  const tenant = session?.tenantId || 'Padrão';
  const environment = session?.environment || 'PROD';
  const moduleName = session?.module || session?.currentModule || 'SIGAFAT';

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Header Unificado: Copilot Protheus */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm z-10 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Bot size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Copilot Protheus
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Oracle Online
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span>{tenant}</span>
              <span>•</span>
              <span>{moduleName}</span>
              <span>•</span>
              <span className="font-mono">{environment}</span>
            </div>
          </div>
        </div>

        {/* Abas de Navegação (Conversa, Histórico, Favoritos) + Tema */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare size={14} />
              <span>Conversa</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <History size={14} />
              <span>Histórico</span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'favorites'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Star size={14} />
              <span>Favoritos</span>
            </button>
          </div>

          <button
            onClick={toggleTheme}
            className="rounded-lg p-1.5 sm:p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Alternar Tema"
          >
            {config.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* Área Central (Chat / Histórico / Favoritos) */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto overflow-hidden">
          {activeTab === 'chat' && (
            <>
              {chat.messages.length === 0 && (
                <div className="pt-6 px-4">
                  <QuickActions />
                </div>
              )}
              <CopilotConversation />
              <div className="p-4 bg-transparent shrink-0">
                <PromptInput />
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Histórico de Dashboards Gerados
              </h3>
              <HistoryList />
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Dashboards Salvos como Favoritos
              </h3>
              <FavoritesList />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

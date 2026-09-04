import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Download,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
  X,
  Zap,
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';
import Composer from '../components/Composer';
import Conversation from '../components/Conversation';
import StructuredResultPanel from '../components/StructuredResultPanel';
import SuggestionCards from '../components/SuggestionCards';

function makeConversationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `conversation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStorageRead(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function conversationKey(context) {
  return [
    context.tenant_id,
    context.user || 'anonymous',
    context.environment,
    context.company,
    context.branch,
    context.module,
  ].map(value => encodeURIComponent(value || 'unknown')).join(':');
}

async function waitForAgentTask(taskId, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await getAgentTaskStatus(taskId);
    if (['success', 'execution_failed', 'error', 'completed'].includes(task.status)) {
      return task;
    }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error('Tempo limite excedido aguardando o processamento do agente.');
}

function readContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    tenant_id: params.get('tenant_id') || params.get('tenant') || 'rodol_prod',
    company: params.get('company_id') || params.get('company') || '01',
    branch: params.get('branch') || '0101',
    user: params.get('user') || 'João Silva',
    profile: params.get('profile') || 'Gerente Financeiro',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || 'c8te0u_prod',
    module: params.get('module') || 'SIGAFAT',
  };
}

export default function AgentWorkspace({ onNavigateToDashboard }) {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = window.localStorage.getItem('copilot.theme');
      if (stored) return stored === 'dark';
    } catch {}
    return false; // Default: Light theme Stitch
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeNav, setActiveNav] = useState('chat-hub');

  const isIframe = typeof window !== 'undefined' && window.parent && window.parent !== window;

  const [conversationId, setConversationId] = useState(() => {
    const initialContext = readContextFromUrl();
    return initialContext.session_id || makeConversationId();
  });

  const context = useMemo(
    () => ({
      tenant_id: externalContext.tenant_id || 'rodol_prod',
      company: externalContext.company || '01',
      branch: externalContext.branch || '0101',
      user: externalContext.user || 'João Silva',
      profile: externalContext.profile || 'Gerente Financeiro',
      session_id: externalContext.session_id || '',
      environment: externalContext.environment || 'c8te0u_prod',
      module: externalContext.module || 'SIGAFAT',
    }),
    [externalContext]
  );

  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync Dark Mode with document element & storage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try { window.localStorage.setItem('copilot.theme', 'dark'); } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try { window.localStorage.setItem('copilot.theme', 'light'); } catch {}
    }
  }, [isDarkMode]);


  const historyStorageKey = useMemo(() => `copilot.conversations:${conversationKey(context)}`, [context]);

  useEffect(() => {
    const storedHistory = safeStorageRead(historyStorageKey, []);
    const conversations = Array.isArray(storedHistory) ? storedHistory : [];
    try {
      const active = window.localStorage.getItem(`${historyStorageKey}:active`);
      const activeId = active || conversationId;
      if (activeId) setConversationId(activeId);
      if (!active) window.localStorage.setItem(`${historyStorageKey}:active`, activeId);
      const activeConversation = conversations.find(item => item.id === activeId);
      if (activeConversation?.messages?.length) {
        setMessages(activeConversation.messages);
      }
    } catch {}
  }, [historyStorageKey, conversationId]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({ role: item.role, text: item.text.trim().slice(0, 4000) }));
    if (!textMessages.some(item => item.role === 'user')) return;

    const storedHistory = safeStorageRead(historyStorageKey, []);
    const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova consulta';
    const next = [
      { id: conversationId, title, date: 'Agora', messages: textMessages },
      ...storedHistory.filter(item => item.id !== conversationId),
    ].slice(0, 20);
    safeStorageWrite(historyStorageKey, next);
  }, [messages, conversationId, historyStorageKey]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event?.data || !['PROTHEUS_CONTEXT', 'cprot-context-update'].includes(event.data.type)) return;
      if (event.source !== window.parent && event.source !== window) return;

      const incoming = event.data.payload || event.data.context || {};
      setExternalContext((prev) => ({
        ...prev,
        tenant_id: incoming.tenant_id || event.data.tenantId || prev.tenant_id,
        company: incoming.company_code || incoming.company || prev.company,
        branch: incoming.branch || prev.branch,
        user: incoming.user || prev.user,
        profile: incoming.profile || prev.profile || 'Gerente Financeiro',
        session_id: incoming.session_id || prev.session_id,
        environment: incoming.environment_code || incoming.environment || prev.environment,
        module: incoming.module || prev.module,
      }));
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const send = async (text) => {
    if (!text?.trim()) return;

    setMessages((current) => [...current, { role: 'user', text }]);
    setLoading(true);

    try {
      if (!context.tenant_id || !context.environment || !context.company || !context.branch) {
        throw new Error('Contexto multi-tenant ausente ou incompleto. Certifique-se de acessar a partir da extensão autorizada com empresa, filial e tenant configurados.');
      }

      const payload = {
        ...context,
        tenant_id: context.tenant_id,
        environment_code: context.environment,
        company_code: context.company,
        empresa: context.company,
        filial: context.branch,
        module: context.module,
        request_id: `REQ-${Date.now()}`,
        conversation_id: conversationId,
        session_id: conversationId,
        prompt: text,
        execute: true,
      };

      const accepted = await askAgent(payload);
      const res = accepted.task_id
        ? await waitForAgentTask(accepted.task_id)
        : accepted;

      setResult(res);

      let replyMessage = 'Análise executiva concluída com sucesso no Protheus.';
      if (res.status === 'execution_failed') {
        replyMessage = `Erro na consulta Oracle: ${res.execution_error || 'Falha na execução.'}`;
      } else if (res.status === 'error') {
        replyMessage = `Consulta bloqueada: ${res.error || res.summary || res.message || 'Contexto não autorizado.'}`;
      } else if (res.summary) replyMessage = res.summary;
      else if (res.message) replyMessage = res.message;
      else if (res.answer) replyMessage = res.answer;

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: replyMessage,
          result: ['completed', 'success'].includes(res.status) ? res : null,
          userPrompt: text,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: `**Erro:** ${String(error.message || error)}` },
      ]);
    }

    setLoading(false);
  };

  const handleNewConversation = () => {
    const newId = makeConversationId();
    setConversationId(newId);
    setMessages([]);
    setResult(null);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, newId);
    } catch {}
  };

  const showWorkspace = Boolean(result);
  const userName = context.user ? context.user.split(' ')[0] : 'Executivo';

  return (
    <div className={`min-h-screen w-full bg-[#F5FAFF] dark:bg-[#0F172A] flex font-sans text-[#171C20] dark:text-[#F8FAFC] antialiased transition-colors duration-200 ${
      isIframe ? 'p-0' : ''
    }`}>
      {/* 1. FIXED LEFT NAVIGATION SIDEBAR (Stitch Model) - Oculto quando dentro de iframe Protheus */}
      {!isIframe && (
        <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-white dark:bg-[#1E293B] z-50 flex flex-col border-r border-[#E2E8F0] dark:border-slate-800 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          {/* Logo Header */}
          <div className="p-6 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004FCE] text-white flex items-center justify-center shadow-md shadow-[#004FCE]/20 shrink-0">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <div className="hidden lg:block">
              <span className="font-bold text-[18px] text-[#004FCE] dark:text-[#60A5FA] tracking-tight leading-none block">
                Copiloto
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-0.5">
                TOTVS Protheus
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveNav('chat-hub')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeNav === 'chat-hub'
                  ? 'bg-[#0F66FF] text-white font-medium shadow-xs'
                  : 'text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#171C20] dark:hover:text-white'
              }`}
            >
              <MessageSquare size={19} className="mr-3 shrink-0" />
              <span className="hidden lg:block text-[14px]">Conversas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('analises')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeNav === 'analises'
                  ? 'bg-[#0F66FF] text-white font-medium shadow-xs'
                  : 'text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#171C20] dark:hover:text-white'
              }`}
            >
              <BarChart3 size={19} className="mr-3 shrink-0" />
              <span className="hidden lg:block text-[14px]">Análises</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('erp-insights')}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeNav === 'erp-insights'
                  ? 'bg-[#0F66FF] text-white font-medium shadow-xs'
                  : 'text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#171C20] dark:hover:text-white'
              }`}
            >
              <Database size={19} className="mr-3 shrink-0" />
              <span className="hidden lg:block text-[14px]">ERP Insights</span>
            </button>

            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="w-full flex items-center px-4 py-3 rounded-xl text-[#004FCE] dark:text-[#60A5FA] bg-[#E0ECFF] dark:bg-blue-950/40 hover:bg-[#d0e2ff] transition-all cursor-pointer font-medium"
              >
                <LayoutDashboard size={19} className="mr-3 shrink-0" />
                <span className="hidden lg:block text-[14px]">Painel Executivo</span>
              </button>
            )}
          </nav>

          {/* Bottom Settings */}
          <div className="px-3 py-4 border-t border-[#E2E8F0] dark:border-slate-800">
            <button
              type="button"
              className="w-full flex items-center px-4 py-3 rounded-xl text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#171C20] dark:hover:text-white transition-all cursor-pointer"
            >
              <Settings size={19} className="mr-3 shrink-0" />
              <span className="hidden lg:block text-[14px]">Ajustes</span>
            </button>
          </div>
        </aside>
      )}

      {/* 2. MAIN CONTAINER */}
      <div className={`flex-1 flex flex-col min-h-screen ${!isIframe ? 'pl-20 lg:pl-64' : 'pl-0 w-full'}`}>
        {/* TOPBAR (Stitch Model) - Oculto quando dentro de iframe Protheus */}
        {!isIframe && (
          <header className="h-16 bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-xl border-b border-[#E2E8F0] dark:border-slate-800 sticky top-0 z-40 flex items-center justify-between px-6 sm:px-8 transition-colors">
            {/* Left: Operational Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-[13px] font-semibold text-[#475569] dark:text-slate-400">
                  Sistema Operacional
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3 text-[11px] font-semibold text-slate-500">
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Filial {context.branch || '0101'}
                </span>
                <span className="bg-blue-50 dark:bg-blue-950/60 text-[#004FCE] dark:text-[#60A5FA] px-2 py-0.5 rounded">
                  {context.module || 'SIGAFAT'}
                </span>
              </div>
            </div>

            {/* Right: Search, Theme Toggle, Profile */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-[#E2E8F0] dark:border-slate-700">
                <Search size={16} className="text-slate-400 mr-2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder="Pesquisar no ERP..."
                  className="bg-transparent border-none outline-none text-[13px] text-[#171C20] dark:text-white w-48 placeholder-slate-400"
                />
              </div>

              {onNavigateToDashboard && (
                <button
                  type="button"
                  onClick={onNavigateToDashboard}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4f9] dark:bg-slate-800 hover:bg-[#e0ecff] text-[#004FCE] dark:text-[#60A5FA] text-xs font-semibold border border-[#e2e8f0] dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <LayoutDashboard size={15} />
                  <span>Painel Executivo</span>
                </button>
              )}

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={() => setIsDarkMode(prev => !prev)}
                title={isDarkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Notifications */}
              <button
                type="button"
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <Bell size={18} />
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                <div className="w-8 h-8 rounded-full bg-[#004FCE] text-white flex items-center justify-center text-[12px] font-bold shadow-xs">
                  {context.user ? context.user.slice(0, 2).toUpperCase() : 'JS'}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-[12px] font-bold text-[#171C20] dark:text-white leading-tight">
                    {context.user || 'João Silva'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {context.profile || 'Gerente Financeiro'}
                  </p>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* 3. CENTER CONTENT AREA */}
        <main className={`flex-1 flex flex-col min-h-0 ${
          isIframe ? 'p-3 h-screen' : 'p-4 sm:p-6 lg:p-8'
        }`}>
          {/* ESTADO INICIAL (Sem resultado e Standalone) -> Hero Central + 4 Bento Sugestões + Floating Prompt */}
          {!showWorkspace && !isIframe && (
            <div className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto my-auto px-2">
              {/* Hero Greeting */}
              <div className="flex flex-col items-center justify-center max-w-3xl w-full text-center mb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#004FCE] text-white flex items-center justify-center shadow-md shadow-[#004FCE]/25">
                    <Sparkles size={22} strokeWidth={2.2} />
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
                </div>
                <h1 className="text-[32px] sm:text-[40px] font-bold text-[#171C20] dark:text-white tracking-tight leading-tight">
                  Olá, {userName}.
                  <br />
                  <span className="text-[20px] sm:text-[24px] font-semibold text-[#475569] dark:text-slate-400">
                    Como posso ajudar com os dados do Protheus hoje?
                  </span>
                </h1>
              </div>

              {/* 4 Bento Sugestões */}
              <div className="w-full mb-8">
                <SuggestionCards disabled={loading} onPick={send} />
              </div>

              {/* Floating Bottom Prompt Composer */}
              <div className="w-full">
                <Composer disabled={loading} onSend={send} placeholder="Pergunte sobre clientes, pedidos, financeiro, faturamento..." />
              </div>
            </div>
          )}

          {/* ESTADO RESULTADO (Ou Modo Iframe) -> Grid 70/30 Split Stitch (Apenas Standalone) / Chat Completo (Iframe) */}
          {(showWorkspace || isIframe) && (
            <div className={`flex-1 flex ${!isIframe ? 'flex-col lg:flex-row gap-4 sm:gap-6' : 'flex-col'} items-stretch min-h-0 h-full`}>
              {/* Left Panel: ANALYTICAL DASHBOARD (Apenas no modo Desktop Standalone) */}
              {showWorkspace && !isIframe && (
                <section className="flex-1 lg:w-[70%] min-w-0 flex flex-col">
                  <StructuredResultPanel
                    result={result}
                    context={context}
                    onClose={() => setResult(null)}
                  />
                </section>
              )}

              {/* Right Panel: COPILOT CHAT (100% no Iframe / 30% no Split Standalone) */}
              <aside className={`
                flex flex-col shrink-0 overflow-hidden
                ${isIframe
                  ? 'w-full h-full p-2.5 bg-white dark:bg-[#1E293B] rounded-xl'
                  : 'stitch-card p-4 sm:p-5 w-full lg:w-[30%] min-h-[580px] h-[calc(100vh-8rem)] sticky top-20'}
              `}>
                {/* Copilot Header */}
                <div className="p-2.5 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      <Database size={10} className="text-[#004FCE]" />
                      PROTHEUS - {context.branch || '0101'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      <User size={10} className="text-[#004FCE]" />
                      {context.user || 'admin'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-[10px] font-semibold text-[#004FCE] dark:text-[#60A5FA] border border-blue-200/60 dark:border-blue-900/60">
                      {context.module || 'Perfil: Negócio'}
                    </span>
                  </div>

                  {/* Ações no modo Iframe (Nova Consulta & Alternador de Tema) */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleNewConversation}
                      title="Iniciar nova consulta"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#004FCE] dark:text-[#60A5FA] hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer border border-blue-200/60 dark:border-blue-900/60"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Nova Consulta</span>
                    </button>

                    {isIframe && (
                      <button
                        type="button"
                        onClick={() => setIsDarkMode(prev => !prev)}
                        title={isDarkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                      >
                        {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Chat History Stream */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {messages.length === 0 && (
                    <div className="space-y-4 py-2">
                      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                        Pronto para consultar. Escolha uma sugestão ou faça uma pergunta:
                      </p>
                      <SuggestionCards disabled={loading} onPick={send} />
                    </div>
                  )}

                  <Conversation
                    messages={messages}
                    context={context}
                    onNavigateToDashboard={onNavigateToDashboard}
                  />

                  {loading && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[12px] text-[#004FCE] dark:text-[#60A5FA] font-medium animate-pulse">
                      <Sparkles size={15} />
                      <span>Consultando dados no Protheus via Oracle QueryRest...</span>
                    </div>
                  )}
                </div>

                {/* Composer at Bottom */}
                <div className="pt-2.5 border-t border-[#E2E8F0] dark:border-slate-800 mt-2">
                  <Composer disabled={loading} onSend={send} placeholder="Pergunte sobre seus dados..." />
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

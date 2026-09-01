import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Layers,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Moon,
  Search,
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
    user: params.get('user') || 'admin',
    profile: params.get('profile') || 'Gerente Financeiro',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || 'c8te0u_prod',
    module: params.get('module') || 'SIGAFAT',
  };
}

export default function AgentWorkspace() {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState('chat'); // 'dashboard' | 'chat'
  const [globalSearch, setGlobalSearch] = useState('');

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

  // Sync Dark Mode with document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Notifica o iframe pai (Protheus WebApp) para expandir ou contrair o drawer
  useEffect(() => {
    if (isIframe) {
      window.parent.postMessage({ type: 'cprot-result-state', open: Boolean(result) }, '*');
    }
  }, [result, isIframe]);

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
    if (window.innerWidth < 1024) {
      setMobileDrawerOpen(false);
    }

    try {
      const payload = {
        ...context,
        tenant_id: context.tenant_id || 'rodol_prod',
        environment_code: context.environment || 'c8te0u_prod',
        company_code: context.company || '01',
        empresa: context.company || '01',
        filial: context.branch || '0101',
        module: context.module || 'SIGAFAT',
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
        { role: 'assistant', text: replyMessage },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: `**Erro:** ${String(error.message || error)}` },
      ]);
    }

    setLoading(false);
  };

  const showWorkspace = Boolean(result);

  return (
    <div className="min-h-screen w-full bg-[#EEF3F8] dark:bg-[#0F172A] flex flex-col font-sans text-[#162D52] dark:text-[#F8FAFC] antialiased transition-colors duration-200">
      {/* 1. HEADER GLOBAL (Exibido no modo Standalone, oculto quando dentro de iframe Protheus compacto) */}
      {!isIframe && (
        <header className="h-[80px] shrink-0 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-40 transition-colors">
          {/* Left: Brand & Organization Context */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F66FF] text-white shadow-md shadow-[#0F66FF]/20">
                <Sparkles size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-black tracking-tight text-[#162D52] dark:text-white">
                    Protheus <span className="text-[#0F66FF] dark:text-[#3882FF]">Copiloto</span>
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-[#0F66FF] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
                    Executivo
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold hidden sm:block">
                  Inteligência Corporativa • Read Only
                </p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-[12px] font-semibold text-[#162D52] dark:text-slate-300">
                <Building2 size={14} className="text-[#0F66FF]" />
                <span>Grupo Empresarial Alpha</span>
                <ChevronDown size={13} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-[12px] font-semibold text-[#162D52] dark:text-slate-300">
                <MapPin size={14} className="text-[#0F66FF]" />
                <span>Filial {context.branch || 'São Paulo'}</span>
                <ChevronDown size={13} className="text-slate-400" />
              </div>
            </div>
          </div>

          {/* Center / Right: Global Search & User Profile */}
          <div className="flex items-center gap-3">
            {/* Campo de Pesquisa */}
            <div className="relative hidden sm:block">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Buscar no sistema..."
                className="h-9 w-[180px] md:w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-3 text-[12px] text-[#162D52] dark:text-white outline-none focus:border-[#0F66FF] focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>

            {/* Theme Switcher Toggle */}
            <button
              type="button"
              onClick={() => setIsDarkMode(prev => !prev)}
              title={isDarkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0F66FF] transition-colors"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notificações */}
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0F66FF] transition-colors"
            >
              <Bell size={17} />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#0F66FF]" />
            </button>

            {/* Perfil */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-700 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F66FF] text-white font-bold text-xs shadow-xs">
                {context.user ? context.user.slice(0, 2).toUpperCase() : 'JS'}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-[12px] font-bold text-[#162D52] dark:text-white leading-tight">
                  {context.user || 'João Silva'}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {context.profile || 'Gerente Financeiro'}
                </p>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* 2. MAIN WORKSPACE (Desktop XL: 72%/28%, Desktop: 70%/30%, Notebook: 65%/35%) */}
      <div className={`flex-1 w-full mx-auto p-3 sm:p-5 lg:p-6 flex gap-5 items-stretch min-h-0 ${
        isIframe && !showWorkspace ? 'max-w-[500px] justify-center' : 'max-w-[1920px]'
      }`}>
        {/* Left Side: WORKSPACE EXECUTIVO (Abre quando há resultado ou em modo standalone) */}
        {(!isIframe || showWorkspace) && (
          <main className={`
            flex-1 w-full lg:w-[65%] xl:w-[70%] 2xl:w-[72%] min-w-0 flex flex-col
            ${showWorkspace ? 'flex' : (isIframe ? 'hidden' : 'flex')}
          `}>
            {result ? (
              <StructuredResultPanel
                result={result}
                context={context}
                onClose={() => setResult(null)}
              />
            ) : (
              /* TELA INICIAL STANDALONE (Sem consulta) */
              <div className="exec-panel flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto">
                <div className="max-w-3xl mb-8">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#0F66FF] dark:text-[#3882FF] block mb-1">
                    INTELIGÊNCIA EXECUTIVA • ERP PROTHEUS
                  </span>
                  <h1 className="text-[28px] sm:text-[34px] lg:text-[40px] font-black text-[#162D52] dark:text-white tracking-tight leading-tight">
                    Olá, como posso ajudar hoje?
                  </h1>
                  <p className="text-[14px] sm:text-[15px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Consulte indicadores, relatórios e análises do seu Protheus utilizando linguagem natural.
                  </p>
                </div>

                {/* SUGESTÕES INICIAIS (Grid de 8 Cards Executivos) */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-bold text-[#162D52] dark:text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-[#0F66FF]" />
                      <span>Análises Corporativas Recomendadas</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">Clique para consultar</span>
                  </div>

                  <SuggestionCards disabled={loading} onPick={send} />
                </div>
              </div>
            )}
          </main>
        )}

        {/* Right Side: COPILOTO IA */}
        <aside className={`
          exec-panel flex flex-col p-4 sm:p-6 w-full shrink-0 min-h-[560px]
          ${isIframe && !showWorkspace ? 'w-full max-w-[480px]' : 'lg:w-[35%] xl:w-[30%] 2xl:w-[28%]'}
        `}>
          {/* Header Copiloto */}
          <header className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0F66FF]">
                <Sparkles size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#162D52] dark:text-white leading-tight">
                  Protheus Copiloto
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#22C55E] font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  <span>Conectado ao Protheus</span>
                </div>
              </div>
            </div>
          </header>

          {/* Conversa Stream */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-[20px] sm:text-[24px] font-black text-[#162D52] dark:text-white tracking-tight leading-tight">
                    Olá, como posso ajudar hoje?
                  </h1>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                    Consulte indicadores e análises com linguagem natural.
                  </p>
                </div>

                <div>
                  <p className="text-[12px] font-bold text-[#162D52] dark:text-white mb-2.5">
                    Sugestões de consulta:
                  </p>
                  <SuggestionCards disabled={loading} onPick={send} />
                </div>
              </div>
            )}

            <Conversation messages={messages} />

            {loading && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[12px] text-[#0F66FF] dark:text-blue-300 font-semibold animate-pulse">
                <Sparkles size={16} />
                <span>Consultando o Protheus via QueryRest Oracle...</span>
              </div>
            )}
          </div>

          {/* Prompt Input (Radius 32px, Enviar #0F66FF, Mic, Anexo) */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <Composer disabled={loading} onSend={send} placeholder="Pergunte sobre seus dados..." />
          </div>
        </aside>
      </div>
    </div>
  );
}

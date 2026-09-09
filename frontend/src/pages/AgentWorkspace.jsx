import { useEffect, useMemo, useState, useRef } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Download,
  FileText,
  History,
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
import { downloadStructuredReport, exportStructuredReport, askAgent, waitForAgentTask } from '../services/api';
import {
  getTaskStatusLabel,
  normalizeTaskPayload,
  TASK_STATUS,
} from '../services/taskStatus';
import Composer from '../components/Composer';
import Conversation from '../components/Conversation';
import { normalizeAgentResult } from '../utils/normalizeAgentResult';
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



function readContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    tenant_id: params.get('tenant_id') || params.get('tenant') || null,
    company: params.get('company_id') || params.get('company') || null,
    branch: params.get('branch') || null,
    user: params.get('user') || null,
    profile: params.get('profile') || null,
    session_id: params.get('session_id') || null,
    environment: params.get('environment_code') || params.get('environment') || null,
    module: params.get('module') || null,
  };
}

export default function AgentWorkspace({ onNavigateToDashboard, externalContext: propContext }) {
  const [externalContext, setExternalContext] = useState(propContext || readContextFromUrl());
  
  useEffect(() => {
    if (propContext) {
      setExternalContext(propContext);
    }
  }, [propContext]);
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
      tenant_id: externalContext.tenant_id || null,
      company: externalContext.company || null,
      branch: externalContext.branch || null,
      user: externalContext.user || null,
      profile: externalContext.profile || null,
      session_id: externalContext.session_id || null,
      environment: externalContext.environment || null,
      module: externalContext.module || null,
    }),
    [externalContext]
  );

  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const abortRef = useRef(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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
    abortRef.current?.abort();
    setTask(null);
    setResult(null);
  }, [historyStorageKey]);

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
      if (activeConversation?.result) {
        setResult(activeConversation.result);
      }
    } catch {}
  }, [historyStorageKey, conversationId]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({ 
        role: item.role, 
        text: item.text.trim().slice(0, 4000),
        result: item.result || null,
        userPrompt: item.userPrompt || null
      }));
    if (!textMessages.some(item => item.role === 'user')) return;

    const storedHistory = safeStorageRead(historyStorageKey, []);
    const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova consulta';
    const next = [
      { id: conversationId, title, date: 'Agora', messages: textMessages, result },
      ...storedHistory.filter(item => item.id !== conversationId),
    ].slice(0, 20);
    safeStorageWrite(historyStorageKey, next);
  }, [messages, conversationId, historyStorageKey, result]);

  useEffect(() => {
    const storedHistory = safeStorageRead(historyStorageKey, []);
    setHistoryItems(Array.isArray(storedHistory) ? storedHistory : []);
  }, [historyStorageKey, messages, result, conversationId]);

  const handleSelectConversation = (item) => {
    if (!item?.id) return;
    setConversationId(item.id);
    setMessages(Array.isArray(item.messages) ? item.messages : []);
    setResult(item.result || null);
    setShowHistory(false);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, item.id);
    } catch {}
  };

  const handleExportConversationPdf = async () => {
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const columns = Array.isArray(result?.columns) && result.columns.length > 0
      ? result.columns
      : (rows.length > 0 ? Object.keys(rows[0]) : []);
    if (!rows.length || !columns.length) return;
    try {
      const metadata = await exportStructuredReport('pdf', {
        title: result?.summary || 'Relatório do Copilot Protheus',
        tenant_code: context.tenant_id,
        environment_code: context.environment,
        company_id: context.company_id || context.company || null,
        columns,
        rows,
      });
      const blob = await downloadStructuredReport(metadata.download_url);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = metadata.filename || `copilot_conversa_${Date.now()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch (error) {
      setTask({ status: 'export_failed', error: error.message || 'Não foi possível exportar o PDF.' });
    }
  };

  const send = async (text) => {
    if (!text?.trim()) return;

    const requiredContext = {
      tenant_id: context.tenant_id,
      environment_code: context.environment,
      company_code: context.company,
      filial: context.branch,
      module: context.module,
    };
    const missingContext = Object.entries(requiredContext)
      .filter(([, value]) => !String(value || '').trim())
      .map(([key]) => key);

    setMessages((current) => [...current, { role: 'user', text }]);
    setResult(null);
    setTask(null);
    setLoading(true);

    if (missingContext.length > 0) {
      const contextError = {
        status: 'error',
        error_source: 'context',
        error_code: 'CONTEXT_NOT_VALIDATED',
        message: `Contexto do Protheus não validado. Campos ausentes: ${missingContext.join(', ')}.`,
        retryable: false,
      };
      setResult(contextError);
      setMessages((current) => [...current, { role: 'assistant', text: contextError.message }]);
      setLoading(false);
      return;
    }

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

      const normalized = normalizeAgentResult(res);

      if (normalized.status === 'error') {
        setResult(null);
        setTask({
          status: res.status || 'error',
          error: normalized.message,
          error_code: normalized.errorCode,
          correlation_id: normalized.correlationId,
        });
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            text: normalized.message,
            status: 'error',
            result: null,
            correlation_id: normalized.correlationId,
            userPrompt: text,
          },
        ]);
        setLoading(false);
        return;
      }

      setResult(normalized.result);
      setTask(normalized.result);

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: normalized.message || 'Análise executiva concluída com sucesso no Protheus.',
          status: 'success',
          result: normalized.result,
          correlation_id: normalized.correlationId,
          userPrompt: text,
        },
      ]);
    } catch (error) {
      setResult(null);
      setTask({ status: 'execution_failed', error: String(error.message || error) });
      setMessages((current) => [
        ...current,
        { role: 'assistant', status: 'error', text: `**Erro:** ${String(error.message || error)}` },
      ]);
    }

    setLoading(false);
  };

  const handleNewConversation = () => {
    abortRef.current?.abort();
    setResult(null);
    setTask(null);
    const newId = makeConversationId();
    setConversationId(newId);
    setMessages([]);
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
                  Filial {context.branch || '—'}
                </span>
                <span className="bg-blue-50 dark:bg-blue-950/60 text-[#004FCE] dark:text-[#60A5FA] px-2 py-0.5 rounded">
                  {context.module || 'Módulo não identificado'}
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
                    {context.user || 'Usuário não identificado'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {context.profile || 'Perfil não identificado'}
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
          <div className={`flex-1 flex ${(!isIframe || result) ? 'flex-col lg:flex-row gap-4 sm:gap-6' : 'flex-col'} items-stretch min-h-0 h-full`}>
            {/* Left Panel: ANALYTICAL DASHBOARD */}
            {showWorkspace && (!isIframe) && (
              <section className={`flex-1 lg:w-[70%] min-w-0 flex flex-col ${!result ? 'hidden lg:flex' : ''}`}>
                <StructuredResultPanel
                  result={result}
                  context={context}
                  onClose={() => {
                    setResult(null);
                  }}
                />
              </section>
            )}

            {/* Right Panel: COPILOT CHAT (100% no Iframe / 30% no Split) */}
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
                      PROTHEUS - {context.branch || 'Filial não identificada'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      <User size={10} className="text-[#004FCE]" />
                      {context.user || 'Usuário não identificado'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-[10px] font-semibold text-[#004FCE] dark:text-[#60A5FA] border border-blue-200/60 dark:border-blue-900/60">
                      {context.module || 'Módulo não identificado'}
                    </span>
                  </div>

                  {/* Ações do chat */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowHistory(prev => !prev)}
                      title="Histórico de conversas"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      <History size={13} />
                      <span className="hidden sm:inline">Histórico</span>
                    </button>
                    {result?.rows?.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportConversationPdf}
                        title="Exportar resultado para PDF"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#004FCE] dark:text-[#60A5FA] hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer border border-blue-200/60 dark:border-blue-900/60"
                      >
                        <FileText size={13} />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                    )}
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

                {showHistory && (
                  <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Histórico de conversas</span>
                      <span className="text-[10px] text-slate-400">{historyItems.length} registro(s)</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {historyItems.length === 0 ? (
                        <p className="px-3 py-4 text-[11px] text-slate-500">Nenhuma conversa persistida neste contexto.</p>
                      ) : historyItems.map(item => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => handleSelectConversation(item)}
                          className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ${item.id === conversationId ? 'bg-blue-50/70 dark:bg-slate-800' : ''}`}
                        >
                          <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{item.title || 'Consulta sem título'}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">{item.date || 'Histórico local'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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

                  {loading && task && (
            <div className="flex items-center gap-4 mb-4 ml-[52px]">
              <div
                className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-center shadow-sm"
                role="status"
                aria-live="polite"
              >
                <div className="w-4 h-4 mr-2 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                {getTaskStatusLabel(task.status)}
                {task.correlationId && (
                  <span className="ml-2 font-mono text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">
                    ID: {task.correlationId}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold transition-colors shadow-sm"
              >
                Cancelar consulta
              </button>
            </div>
          )}
          {loading && !task && (
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

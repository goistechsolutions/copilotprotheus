import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Layers,
  MessageSquare,
  Sparkles,
  User,
  X,
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

export default function AgentWorkspace() {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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

      let replyMessage = 'Consulta realizada com sucesso no Protheus.';
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

  return (
    <div className="min-h-screen w-full bg-[#EEF3F8] p-3 sm:p-5 lg:p-6 flex flex-col items-center justify-center antialiased">
      {/* Main Responsive Grid Layout */}
      <div className="w-full max-w-[1840px] flex-1 flex flex-col lg:flex-row gap-5 items-stretch min-h-[calc(100vh-48px)]">
        {/* Left Side: Painel Executivo (70% on 1440px+, 65% on 1024px-1439px, Protagonist on Tablet/Mobile) */}
        <main className="flex-1 w-full lg:w-[65%] 2xl:w-[70%] min-w-0 flex flex-col min-h-[620px]">
          <StructuredResultPanel
            result={result}
            context={context}
            onClose={result ? () => setResult(null) : undefined}
          />
        </main>

        {/* Right Side: Protheus Copiloto (30% on 1440px+, 35% on 1024px-1439px, Drawer on Tablet/Mobile) */}
        <aside className={`
          copiloto-panel flex flex-col p-5 sm:p-6 relative overflow-hidden bg-white
          w-full lg:w-[35%] 2xl:w-[30%] shrink-0 min-h-[580px] lg:h-auto
          ${mobileDrawerOpen ? 'fixed inset-4 z-50 shadow-2xl border border-slate-200' : 'hidden lg:flex'}
        `}>
          {/* Header */}
          <header className="flex items-center justify-between pb-3.5 border-b border-[#edf2f7]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#0F66FF]">
                <Sparkles size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#102a45] leading-tight">
                  Protheus Copiloto
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#22C55E] font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  <span>Conectado</span>
                </div>
              </div>
            </div>

            {/* Mobile close drawer */}
            {mobileDrawerOpen && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            )}
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Executive Greeting (Sizes: 40px desktop, 32px notebook, 28px tablet, 24px mobile) */}
            {messages.length === 0 && (
              <div className="pt-2 pb-1">
                <h1 className="text-[24px] sm:text-[28px] lg:text-[32px] 2xl:text-[40px] font-black text-[#102a45] tracking-tight leading-tight">
                  Olá, como posso ajudar hoje?
                </h1>
              </div>
            )}

            {/* Suggestions Grid */}
            {messages.length === 0 && (
              <SuggestionCards disabled={loading} onPick={send} />
            )}

            {/* Messages Thread */}
            <Conversation messages={messages} />

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#EEF3F8] text-[12px] text-[#0F66FF] font-semibold">
                <Sparkles size={16} className="animate-spin" />
                <span>Consultando o Protheus via QueryRest Oracle...</span>
              </div>
            )}
          </div>

          {/* Bottom Composer */}
          <div className="pt-3 border-t border-[#edf2f7]">
            <Composer disabled={loading} onSend={send} />
          </div>
        </aside>
      </div>

      {/* Floating Action Button for Tablet/Mobile: "✦ Abrir Copiloto" */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#0F66FF] px-5 py-3 text-white font-bold text-sm shadow-xl shadow-[#0F66FF]/30 active:scale-95 transition-all"
        >
          <Sparkles size={16} />
          <span>✦ Perguntar ao Copiloto</span>
        </button>
      </div>
    </div>
  );
}

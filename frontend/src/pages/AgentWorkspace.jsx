import React, { useEffect, useMemo, useState } from 'react';
import { askAgent, getAgentTaskStatus } from '../services/api';
import ContextBanner from '../components/ContextBanner';
import Composer from '../components/Composer';
import HistoryRail from '../components/HistoryRail';
import SuggestionCards from '../components/SuggestionCards';
import Conversation from '../components/Conversation';
import ResultPane from '../components/ResultPane';
import LogViewer from '../components/LogViewer';
import { Bot, ChevronDown, Plus, Sparkles } from 'lucide-react';

const suggestions = [
  { title: 'Faturamento do mês', subtitle: 'por filial' },
  { title: 'Títulos vencendo na semana', subtitle: 'contas a pagar' },
  { title: 'Top 5 produtos', subtitle: 'mais vendidos' },
  { title: 'Clientes com risco', subtitle: 'inadimplência' },
];

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
  } catch {
    // O histórico persistido no servidor continua sendo a fonte de memória.
  }
}

function conversationKey(context) {
  return [context.tenant_id, context.user || 'anonymous'].map(value => encodeURIComponent(value || 'unknown')).join(':');
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
    tenant_id: params.get('tenant') || '',
    company: params.get('company') || '',
    branch: params.get('branch') || '',
    user: params.get('user') || '',
    profile: params.get('profile') || 'Negócio',
    session_id: params.get('session_id') || '',
    environment: params.get('environment') || '',
    module: params.get('module') || '',
  };
}

export default function AgentWorkspace() {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [isLogMode, setIsLogMode] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    const initialContext = readContextFromUrl();
    return initialContext.session_id || makeConversationId();
  });

  const context = useMemo(
    () => ({
      tenant_id: externalContext.tenant_id || '',
      company: externalContext.company || '',
      branch: externalContext.branch || '',
      user: externalContext.user || '',
      profile: externalContext.profile || 'Negócio',
      session_id: externalContext.session_id || '',
      environment: externalContext.environment || '',
      module: externalContext.module || '',
    }),
    [externalContext]
  );

  const hasContext = !!(context.tenant_id || context.company || context.branch || context.user || context.module);

  const [state, setState] = useState({
    ready: hasContext,
    message: hasContext
      ? 'Contexto do Protheus identificado.'
      : 'Copilot disponível sem contexto validado do Protheus.',
  });

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: hasContext
        ? 'Pronto. Posso ajudar com consultas, análises e relatórios.'
        : 'Pronto. Posso ajudar mesmo sem contexto validado do Protheus.',
    },
  ]);

  const historyStorageKey = useMemo(() => `copilot.conversations:${conversationKey(context)}`, [context]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const storedHistory = safeStorageRead(historyStorageKey, []);
    const conversations = Array.isArray(storedHistory) ? storedHistory : [];
    setHistory(conversations);
    try {
      const active = window.localStorage.getItem(`${historyStorageKey}:active`);
      const activeId = active || conversationId;
      if (activeId) setConversationId(activeId);
      if (!active) window.localStorage.setItem(`${historyStorageKey}:active`, activeId);
      const activeConversation = conversations.find(item => item.id === activeId);
      if (activeConversation?.messages?.length) setMessages(activeConversation.messages);
    } catch {
      // O backend continuará usando o conversation_id da sessão atual.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({ role: item.role, text: item.text.trim().slice(0, 4000) }));
    if (!textMessages.some(item => item.role === 'user')) return;

    setHistory((items) => {
      const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova conversa';
      const next = [
        { id: conversationId, title, date: 'Agora', messages: textMessages },
        ...items.filter(item => item.id !== conversationId),
      ].slice(0, 20);
      safeStorageWrite(historyStorageKey, next);
      return next;
    });
  }, [messages, conversationId, historyStorageKey]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event?.data || event.data.type !== 'PROTHEUS_CONTEXT') return;

      const incoming = event.data.context || {};
      setExternalContext((prev) => ({
        ...prev,
        tenant_id: event.data.tenantId || prev.tenant_id,
        company: incoming.company || prev.company,
        branch: incoming.branch || prev.branch,
        user: incoming.user || prev.user,
        profile: incoming.profile || prev.profile || 'Negócio',
        session_id: incoming.session_id || prev.session_id,
        environment: incoming.environment || prev.environment,
        module: incoming.module || prev.module,
      }));
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const readyMessage = hasContext
      ? 'Contexto do Protheus identificado.'
      : 'Copilot disponível sem contexto validado do Protheus.';

    setState({
      ready: hasContext,
      message: readyMessage,
    });
  }, [hasContext]);

  const send = async (text) => {
    if (!text?.trim()) return;

    if (text.trim() === '/log') {
      setIsLogMode(true);
      return;
    }

    const missingContext = [
      ['tenant_id', context.tenant_id],
      ['environment_code', context.environment],
      ['company_code', context.company],
      ['branch', context.branch],
      ['module', context.module],
    ].filter(([, value]) => !value?.trim()).map(([name]) => name);

    if (missingContext.length > 0) {
      setMessages((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: `Consulta bloqueada: contexto do Protheus incompleto (${missingContext.join(', ')}). Abra o Copilot dentro do ERP com o ambiente, empresa, filial e módulo selecionados.`,
        },
      ]);
      return;
    }

    const currentHistory = [
      ...messages,
      { role: 'user', text },
    ]
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .slice(-12)
      .map(item => ({ role: item.role, content: item.text.trim().slice(0, 4000) }));

    setMessages((m) => [...m, { role: 'user', text }]);
    setHistory((items) => {
      const next = [
        { id: conversationId, title: text.trim().slice(0, 52), date: 'Agora' },
        ...items.filter(item => item.id !== conversationId),
      ].slice(0, 20);
      safeStorageWrite(historyStorageKey, next);
      return next;
    });
    setLoading(true);

    try {
      const payload = {
        ...context,
        environment_code: context.environment,
        company_code: context.company,
        empresa: context.company,
        filial: context.branch,
        request_id: `REQ-${Date.now()}`,
        conversation_id: conversationId,
        session_id: conversationId,
        history: currentHistory,
        prompt: text,
        execute: true,
      };

      const accepted = await askAgent(payload);
      const res = accepted.task_id
        ? await waitForAgentTask(accepted.task_id)
        : accepted;

      setResult(res);

      let replyMessage = 'Consulta concluída.';
      if (res.status === 'execution_failed') {
        replyMessage = `Consulta não executada no Protheus: ${res.execution_error || 'o ERP retornou uma falha.'}`;
      } else if (res.status === 'error') {
        replyMessage = `Consulta bloqueada: ${res.error || 'o contexto não foi validado.'}`;
      } else if (res.summary) replyMessage = res.summary;
      else if (res.message) replyMessage = res.message;
      else if (res.answer) replyMessage = res.answer;

      setMessages((m) => [
        ...m,
        { role: 'assistant', text: replyMessage },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Erro: ${String(e.message || e)}` },
      ]);
    }

    setLoading(false);
  };

  const selectConversation = (item) => {
    if (!item?.id) return;
    setConversationId(item.id);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, item.id);
    } catch {
      // O histórico do backend segue disponível mesmo sem localStorage.
    }
    if (Array.isArray(item.messages) && item.messages.length) {
      setMessages(item.messages);
    } else {
      setMessages([{ role: 'assistant', text: 'Conversa selecionada. Envie uma nova pergunta para continuar.' }]);
    }
    setResult(null);
    setSelected(item);
  };

  const startNewConversation = () => {
    const nextConversationId = makeConversationId();
    setConversationId(nextConversationId);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, nextConversationId);
    } catch {
      // Sem persistência local, o id ainda permanece válido nesta sessão.
    }
    setMessages([{ role: 'assistant', text: 'Nova conversa iniciada.' }]);
    setResult(null);
    setSelected(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f4f8fc] font-sans text-[#203c60]">
      <div className="hidden md:flex">
        <HistoryRail
          items={history}
          onSelect={selectConversation}
          onNew={startNewConversation}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fbfe]">
        <header className="z-10 border-b border-[#e3ecf4] bg-white/95 px-4 py-3 backdrop-blur sm:px-7">
          <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4fc] text-[#2476bd]">
                <Bot size={21} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[15px] font-bold tracking-[-0.01em] text-[#1e3b5e]">
                    Protheus Copiloto
                  </h1>
                  <span className="hidden rounded-full bg-[#f0f6fb] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7790a9] sm:inline-flex">
                    Assistente IA
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[#8495a8]">
                  Consultas seguras sobre o seu ERP
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <ContextBanner state={state} />
              <button
                type="button"
                onClick={startNewConversation}
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#dfe9f2] bg-white px-3 text-[11px] font-semibold text-[#5f7893] transition-colors hover:border-[#bdd7ed] hover:bg-[#f6fbff] hover:text-[#2377bd] sm:flex"
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                Nova conversa
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="mx-auto flex w-full max-w-[980px] flex-col px-4 pb-6 pt-8 sm:px-8 sm:pt-11">
            <section className="mb-8 flex items-start gap-3 sm:mb-10 sm:gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4fc] text-[#2879bf] shadow-[0_4px_12px_rgba(42,119,184,0.08)] sm:h-11 sm:w-11">
                <Sparkles size={20} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7190ad]">
                  Seu assistente de dados
                </p>
                <h2 className="text-[25px] font-semibold leading-tight tracking-[-0.03em] text-[#1c3a5e] sm:text-[31px]">
                  Olá, como posso ajudar você hoje?
                </h2>
                <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-[#7b8fa6]">
                  Faça uma pergunta sobre o Protheus e receba uma resposta contextualizada para a empresa, filial e módulo ativos.
                </p>
              </div>
            </section>

            {messages.length <= 1 && !selected && (
              <div className="mb-8">
                <SuggestionCards
                  items={suggestions}
                  disabled={loading}
                  onPick={(item) => send(item.title)}
                />
              </div>
            )}

            <Conversation messages={messages} />

            {loading && (
              <div className="mt-2 flex items-center gap-2.5 text-[12px] text-[#7790a9]" aria-live="polite">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d7e8f6] bg-[#edf6fd] text-[#2b78bc]">
                  <Bot size={16} className="animate-pulse" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="rounded-2xl rounded-bl-md border border-[#e1eaf2] bg-white px-4 py-2.5 shadow-[0_3px_12px_rgba(49,84,117,0.05)]">
                  Consultando o Protheus…
                </span>
              </div>
            )}

            {selected && (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#cfe3f4] bg-[#f0f7fd] px-4 py-3 text-[12px] text-[#3d6f98]">
                <ChevronDown size={15} className="rotate-[-90deg]" aria-hidden="true" />
                Histórico selecionado: <strong>{selected.title}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#e6eef5] bg-white/90 px-4 pb-3 pt-3 backdrop-blur sm:px-8 sm:pb-4">
          <div className="mx-auto w-full max-w-[980px]">
            <Composer
              disabled={loading}
              onSend={send}
              placeholder="Pergunte qualquer coisa sobre o Protheus... (ou digite /log)"
            />
          </div>
        </div>
      </main>

      <aside className={`w-full shrink-0 flex-col overflow-y-auto border-t border-[#e1eaf2] bg-white xl:w-[420px] xl:border-l xl:border-t-0 ${result || isLogMode ? 'flex' : 'hidden'}`}>
        {isLogMode ? (
          <LogViewer onClose={() => setIsLogMode(false)} />
        ) : (
          <ResultPane result={result} />
        )}
      </aside>
    </div>
  );
}


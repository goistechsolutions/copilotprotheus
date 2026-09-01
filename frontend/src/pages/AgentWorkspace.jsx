import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Columns2,
  FileText,
  History,
  Layers,
  MapPin,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';
import Composer from '../components/Composer';
import Conversation from '../components/Conversation';
import LogViewer from '../components/LogViewer';
import StructuredResultPanel from '../components/StructuredResultPanel';
import SuggestionCards from '../components/SuggestionCards';

const suggestions = [
  { title: 'Faturamento consolidado do mês', subtitle: 'Totais faturados por filial e clientes' },
  { title: 'Títulos a pagar na semana', subtitle: 'Consultar compromissos financeiros' },
  { title: 'Top 5 produtos mais vendidos', subtitle: 'Curva ABC de itens faturados' },
  { title: 'Clientes com títulos em atraso', subtitle: 'Análise de risco e inadimplência' },
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
    // Memória do backend permanece ativa
  }
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
    profile: params.get('profile') || 'Negócio',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || 'c8te0u_prod',
    module: params.get('module') || 'SIGAFAT',
  };
}

function StatusBadge({ ready }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
      ready 
        ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700 shadow-sm' 
        : 'border-amber-200 bg-amber-50/90 text-amber-700'
    }`}>
      <span className={`flex h-2 w-2 rounded-full ${ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      <span>{ready ? 'Conectado ao Protheus' : 'Contexto pendente'}</span>
    </div>
  );
}

function HeaderContextChip({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-2xs backdrop-blur-xs">
      <Icon size={13} className="text-indigo-600 shrink-0" strokeWidth={2} />
      <span className="text-slate-400 font-normal">{label}:</span>
      <span className="font-semibold text-slate-700 truncate max-w-[120px]">{value}</span>
    </div>
  );
}

export default function AgentWorkspace() {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'chat_only' | 'split' | 'canvas_only' | 'log'
  const [conversationId, setConversationId] = useState(() => {
    const initialContext = readContextFromUrl();
    return initialContext.session_id || makeConversationId();
  });

  const context = useMemo(
    () => ({
      tenant_id: externalContext.tenant_id || 'rodol_prod',
      company: externalContext.company || '01',
      branch: externalContext.branch || '0101',
      user: externalContext.user || 'admin',
      profile: externalContext.profile || 'Negócio',
      session_id: externalContext.session_id || '',
      environment: externalContext.environment || 'c8te0u_prod',
      module: externalContext.module || 'SIGAFAT',
    }),
    [externalContext]
  );

  const hasContext = Boolean(context.tenant_id && context.environment && context.module);

  const [state, setState] = useState({
    ready: hasContext,
    message: hasContext
      ? 'Contexto do Protheus ativo e conectado.'
      : 'Copilot disponível com fallbacks seguros.',
  });

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Sou o **Copilot Protheus AI**, seu assistente corporativo para consultas seguras, indicadores em tempo real e geração de relatórios no ERP.',
    },
  ]);

  const historyStorageKey = useMemo(() => `copilot.conversations:${conversationKey(context)}`, [context]);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

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
      if (activeConversation?.messages?.length) {
        setMessages(activeConversation.messages);
        setSelected(activeConversation);
      }
    } catch {
      // Backend continua disponível
    }
  }, [historyStorageKey, conversationId]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({ role: item.role, text: item.text.trim().slice(0, 4000) }));
    if (!textMessages.some(item => item.role === 'user')) return;

    setHistory((items) => {
      const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova consulta';
      const next = [
        { id: conversationId, title, date: 'Agora', messages: textMessages },
        ...items.filter(item => item.id !== conversationId),
      ].slice(0, 20);
      safeStorageWrite(historyStorageKey, next);
      return next;
    });
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
        profile: incoming.profile || prev.profile || 'Negócio',
        session_id: incoming.session_id || prev.session_id,
        environment: incoming.environment_code || incoming.environment || prev.environment,
        module: incoming.module || prev.module,
      }));
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-result-state', open: Boolean(result) }, '*');
    }
  }, [result]);

  const send = async (text) => {
    if (!text?.trim()) return;

    if (text.trim() === '/log' || text.trim() === '/sql') {
      setViewMode('log');
      return;
    }

    setMessages((currentMessages) => [...currentMessages, { role: 'user', text }]);
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

      let replyMessage = 'Consulta concluída com sucesso no ERP.';
      if (res.status === 'execution_failed') {
        replyMessage = `A consulta gerou um SQL que falhou no Protheus: ${res.execution_error || 'Erro na execução Oracle.'}`;
      } else if (res.status === 'error') {
        const detail = res.error || res.summary || res.message || 'O contexto não foi autorizado.';
        replyMessage = `Consulta bloqueada: ${detail}`;
      } else if (res.summary) replyMessage = res.summary;
      else if (res.message) replyMessage = res.message;
      else if (res.answer) replyMessage = res.answer;

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', text: replyMessage },
      ]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', text: `**Falha:** ${String(error.message || error)}` },
      ]);
    }

    setLoading(false);
  };

  const selectConversation = (item) => {
    if (!item?.id) return;
    setConversationId(item.id);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, item.id);
    } catch {}
    if (Array.isArray(item.messages) && item.messages.length) {
      setMessages(item.messages);
    } else {
      setMessages([{ role: 'assistant', text: 'Conversa restaurada. Como posso continuar ajudando?' }]);
    }
    setResult(null);
    setSelected(item);
  };

  const startNewConversation = () => {
    const nextConversationId = makeConversationId();
    setConversationId(nextConversationId);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, nextConversationId);
    } catch {}
    setMessages([{ role: 'assistant', text: 'Nova sessão iniciada. Faça uma pergunta sobre qualquer dado operacional do Protheus.' }]);
    setResult(null);
    setSelected(null);
    setViewMode('auto');
  };

  // Determinar layout responsivo baseado no viewMode e presença de resultado
  const isSplitView = (viewMode === 'auto' && Boolean(result)) || viewMode === 'split';
  const isLogMode = viewMode === 'log';
  const isCanvasOnly = viewMode === 'canvas_only' && Boolean(result);
  const isChatOnly = viewMode === 'chat_only' || (!result && !isLogMode);

  return (
    <div className="flex min-h-screen w-full flex-col font-sans text-slate-800 antialiased">
      {/* Google AI Studio Top Navigation Bar */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-2xs">
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1720px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Logo & Model */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={19} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-black tracking-tight text-slate-900">
                  Copilot <span className="gemini-gradient-text">Protheus</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/50">
                  <Zap size={10} className="fill-indigo-600 text-indigo-600" />
                  Studio AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden md:block">
                Powered by Gemini 2.0 Flash • Oracle TOTVS Cloud
              </p>
            </div>
          </div>

          {/* Context Badges */}
          <div className="hidden lg:flex items-center gap-2">
            <HeaderContextChip icon={Building2} label="Tenant" value={context.tenant_id} />
            <HeaderContextChip icon={MapPin} label="Filial" value={context.branch} />
            <HeaderContextChip icon={FileText} label="Módulo" value={context.module} />
          </div>

          {/* View Mode Switcher & Actions */}
          <div className="flex items-center gap-2.5">
            <StatusBadge ready={state.ready} />

            {/* Layout Mode Toggles when result is active */}
            {result && !isLogMode && (
              <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  title="Visão Dividida (Chat + Dados)"
                  className={`flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all ${
                    isSplitView && viewMode !== 'canvas_only'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Columns2 size={13} />
                  <span>Dividido</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('canvas_only')}
                  title="Expandir Dados & Gráficos"
                  className={`flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all ${
                    isCanvasOnly
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 size={13} />
                  <span>Painel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('chat_only')}
                  title="Focar no Chat"
                  className={`flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-all ${
                    isChatOnly
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Chat</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={startNewConversation}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all active:scale-95"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Nova Consulta</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Container */}
      <div className="mx-auto flex w-full max-w-[1720px] flex-1 min-h-0 p-3 sm:p-5 lg:p-6 gap-6">
        {/* Left Pane: Interactive Chat & Studio Composer */}
        {!isCanvasOnly && (
          <div className={`flex flex-col min-h-0 transition-all duration-300 ${
            isSplitView 
              ? 'w-full lg:w-[45%] xl:w-[40%] shrink-0' 
              : 'w-full max-w-[840px] mx-auto'
          }`}>
            <div className="studio-card flex flex-col flex-1 min-h-[580px] rounded-3xl overflow-hidden shadow-md">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white/70">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs">
                    AI
                  </div>
                  <div>
                    <h2 className="text-[13px] font-bold text-slate-800">Assistente Analítico</h2>
                    <p className="text-[10px] text-slate-400">Contexto {context.module} • Filial {context.branch}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewMode(prev => prev === 'log' ? 'auto' : 'log')}
                    className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition-all ${
                      isLogMode
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Terminal size={12} />
                    <span>SQL / Logs</span>
                  </button>
                </div>
              </div>

              {/* Chat Stream Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Welcome / Suggestions Cards when conversation is fresh */}
                {messages.length <= 1 && !selected && !isLogMode && (
                  <div className="space-y-4 py-2">
                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>Como posso ajudar na tomada de decisão hoje?</span>
                      </div>
                      <p className="text-[12px] text-slate-600 leading-relaxed">
                        Pergunte sobre vendas, notas fiscais, contas a pagar/receber ou estoque. O Copilot gera o SQL Oracle nativo com governança RBAC estrita.
                      </p>
                    </div>

                    <SuggestionCards items={suggestions} disabled={loading} onPick={(item) => send(item.title)} />
                  </div>
                )}

                {/* History Dropdown Drawer */}
                {history.length > 1 && !isLogMode && (
                  <details className="group rounded-2xl border border-slate-200/80 bg-slate-50/60 transition-all" open={messages.length > 2}>
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <History size={13} className="text-indigo-600" />
                        Consultas Recentes ({history.length})
                      </span>
                      <ChevronDown size={13} className="transition-transform group-open:rotate-180 text-slate-400" />
                    </summary>
                    <div className="space-y-1 border-t border-slate-200/60 p-2 max-h-[140px] overflow-y-auto">
                      {history.slice(0, 6).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectConversation(item)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                            selected?.id === item.id 
                              ? 'bg-indigo-100/70 font-bold text-indigo-800' 
                              : 'text-slate-600 hover:bg-slate-200/60'
                          }`}
                        >
                          <MessageSquarePlus size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}

                {/* Messages stream */}
                <Conversation messages={messages} />

                {/* Pulsating Loading Indicator */}
                {loading && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 text-[12px] text-indigo-900 animate-pulse">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <Bot size={15} />
                    </span>
                    <div className="space-y-0.5">
                      <p className="font-bold">Consultando o Protheus via QueryRest...</p>
                      <p className="text-[10px] text-indigo-600">Validando regras de dicionário e executando query segura no Oracle.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Studio Composer Area */}
              <div className="p-4 bg-white/80 border-t border-slate-100/80">
                <Composer disabled={loading} onSend={send} />
              </div>
            </div>
          </div>
        )}

        {/* Right Pane: Analytical Canvas / Structured Results & Data Visualizer */}
        {(isSplitView || isCanvasOnly || isLogMode) && (
          <main className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="studio-card flex flex-col flex-1 min-h-[580px] rounded-3xl overflow-hidden shadow-md bg-white">
              {isLogMode ? (
                <LogViewer onClose={() => setViewMode('auto')} />
              ) : result ? (
                <StructuredResultPanel 
                  result={result} 
                  embedded 
                  onClose={() => { setResult(null); setViewMode('auto'); }} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-inner mb-4">
                    <BarChart3 size={32} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Painel Analítico Studio</h3>
                  <p className="mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
                    Envie uma consulta no painel ao lado para gerar indicadores, gráficos interativos e tabelas exportáveis para Excel.
                  </p>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

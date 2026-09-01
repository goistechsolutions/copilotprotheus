import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  History,
  Layers,
  MapPin,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';
import Composer from '../components/Composer';
import Conversation from '../components/Conversation';
import LogViewer from '../components/LogViewer';
import StructuredResultPanel from '../components/StructuredResultPanel';
import SuggestionCards from '../components/SuggestionCards';

const suggestions = [
  { title: 'Faturamento do mês', subtitle: 'Consolidar dados de vendas por filial e produto' },
  { title: 'Títulos vencendo na semana', subtitle: 'Consultar contas a pagar no SIGAFIN' },
  { title: 'Top 5 produtos em estoque', subtitle: 'Identificar itens com maior valor e saldo' },
  { title: 'Clientes com risco de crédito', subtitle: 'Analisar títulos em atraso e inadimplência' },
];

const PROTHEUS_MODULES = [
  { code: 'FAT', name: 'SIGAFAT - Faturamento e Vendas' },
  { code: 'FIN', name: 'SIGAFIN - Financeiro e Caixa' },
  { code: 'EST', name: 'SIGAEST - Estoque e Custos' },
  { code: 'CTB', name: 'SIGACTB - Contabilidade Gerencial' },
  { code: 'COM', name: 'SIGACOM - Compras e Suprimentos' },
  { code: 'FIS', name: 'SIGAFIS - Livros Fiscais e SPED' },
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
    // Local storage fallback
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

async function waitForAgentTask(taskId, timeoutMs = 60000) {
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
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  return {
    tenant_id: params.get('tenant_id') || params.get('tenant') || 'TOTVS-ENTERPRISE',
    company: params.get('company') || '01',
    branch: params.get('branch') || '01',
    user: params.get('user') || 'admin.protheus',
    profile: params.get('profile') || 'Diretoria & Controladoria',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || 'PROD',
    module: params.get('module') || 'FAT',
  };
}

function StatusPill({ ready }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${ready ? 'border-[#ccebd9] bg-[#f0fbf4] text-[#268052]' : 'border-[#f3dfb4] bg-[#fffaf0] text-[#9b7127]'}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ready ? 'bg-[#2eaa6b] text-white' : 'bg-[#e7b95f] text-white'}`}>
        {ready ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : <CircleAlert size={12} strokeWidth={2.2} aria-hidden="true" />}
      </span>
      {ready ? 'Contexto conectado' : 'Contexto incompleto'}
    </div>
  );
}

function ContextChip({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#e5edf4] bg-[#fbfdff] px-3 py-2">
      <Icon size={14} className="shrink-0 text-[#6d99bc]" strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#99aabd]">{label}</p>
        <p className="truncate text-[11px] font-semibold text-[#405d78]">{value || 'Não informado'}</p>
      </div>
    </div>
  );
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
      tenant_id: externalContext.tenant_id || 'TOTVS-ENTERPRISE',
      company: externalContext.company || '01',
      branch: externalContext.branch || '01',
      user: externalContext.user || 'admin.protheus',
      profile: externalContext.profile || 'Diretoria & Controladoria',
      session_id: externalContext.session_id || '',
      environment: externalContext.environment || 'PROD',
      module: externalContext.module || 'FAT',
    }),
    [externalContext]
  );

  const requiredContextValues = [
    context.tenant_id,
    context.environment,
    context.company,
    context.branch,
    context.module,
  ];
  const hasContext = requiredContextValues.every(value => String(value || '').trim().length > 0);

  const [state, setState] = useState({
    ready: hasContext,
    message: hasContext
      ? 'Contexto do Protheus identificado e ativo.'
      : 'Copilot disponível sem contexto validado do Protheus.',
  });

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Sou o **Copilot Protheus**. Estou conectado à base autorizada do seu ERP. Como posso ajudar nas análises de vendas, financeiro, estoque ou contabilidade hoje?',
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
      if (activeConversation?.messages?.length) {
        setMessages(activeConversation.messages);
        setSelected(activeConversation);
      }
    } catch {
      // Backend handles fallback
    }
  }, [historyStorageKey, conversationId]);

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

  const send = async (text) => {
    if (!text?.trim()) return;

    if (text.trim() === '/log') {
      setIsLogMode(true);
      return;
    }

    setMessages((currentMessages) => [...currentMessages, { role: 'user', text }]);
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
        const detail = res.error || res.summary || res.message || 'o contexto não foi validado.';
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
        { role: 'assistant', text: `Erro: ${String(error.message || error)}` },
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
      // Ignore
    }
    if (Array.isArray(item.messages) && item.messages.length) {
      setMessages(item.messages);
    } else {
      setMessages([{ role: 'assistant', text: 'Conversa selecionada. Envie uma nova pergunta para continuar.' }]);
    }
    setResult(null);
    setSelected(item);
    setIsLogMode(false);
  };

  const startNewConversation = () => {
    const nextConversationId = makeConversationId();
    setConversationId(nextConversationId);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, nextConversationId);
    } catch {
      // Ignore
    }
    setMessages([{ role: 'assistant', text: 'Nova conversa iniciada. Como posso ajudar você no Protheus?' }]);
    setResult(null);
    setSelected(null);
    setIsLogMode(false);
  };

  const showWorkspace = Boolean(result || isLogMode);

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f4f8fb] font-sans text-[#1d3c5d]">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-[#dfe8f0] bg-white/95 shadow-[0_1px_10px_rgba(44,78,108,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1680px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#1565c0] to-[#2679bd] text-white shadow-md shadow-blue-500/20">
              <Sparkles size={20} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[19px] font-extrabold tracking-[-0.03em] text-[#16466e]">Protheus <span className="text-[#2578bd]">Copilot</span></span>
                <span className="rounded-md bg-[#edf6fd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1e6ca8]">AI ERP</span>
              </div>
              <p className="text-[10px] text-[#8699ad]">Assistente Inteligente & Auditoria TOTVS</p>
            </div>
          </div>

          {/* Quick ERP Context Controls */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-2.5 lg:flex">
            {/* Tenant Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#e2ecf4] bg-[#f8fbfe] px-3 py-1.5 text-[11px]">
              <Building2 size={14} className="text-[#648dae]" />
              <select
                value={externalContext.tenant_id}
                onChange={e => setExternalContext(prev => ({ ...prev, tenant_id: e.target.value }))}
                className="bg-transparent font-semibold text-[#305372] outline-none cursor-pointer"
              >
                <option value="TOTVS-ENTERPRISE">TOTVS Enterprise (Matriz)</option>
                <option value="METAL-SUL">Metalúrgica Sul</option>
                <option value="AGRO-BR">AgroNegócios Brasil</option>
              </select>
            </div>

            {/* Branch Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#e2ecf4] bg-[#f8fbfe] px-3 py-1.5 text-[11px]">
              <MapPin size={14} className="text-[#648dae]" />
              <select
                value={externalContext.branch}
                onChange={e => setExternalContext(prev => ({ ...prev, branch: e.target.value }))}
                className="bg-transparent font-semibold text-[#305372] outline-none cursor-pointer"
              >
                <option value="01">Filial 01 - Matriz Centro SP</option>
                <option value="02">Filial 02 - Logística Campinas</option>
                <option value="03">Filial 03 - Portuária Santos</option>
              </select>
            </div>

            {/* Module Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#e2ecf4] bg-[#f8fbfe] px-3 py-1.5 text-[11px]">
              <Layers size={14} className="text-[#648dae]" />
              <select
                value={externalContext.module}
                onChange={e => setExternalContext(prev => ({ ...prev, module: e.target.value }))}
                className="bg-transparent font-bold text-[#1f6aa5] outline-none cursor-pointer"
              >
                {PROTHEUS_MODULES.map(m => (
                  <option key={m.code} value={m.code}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill ready={state.ready} />

            {/* Switch to Admin Portal Button */}
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0e1726] px-3.5 py-2 text-[12px] font-semibold text-cyan-300 shadow-sm transition hover:bg-[#15233a] hover:border-cyan-500/40"
              title="Acessar o Painel Administrativo e Governança"
            >
              <ShieldCheck size={16} className="text-cyan-400" />
              <span className="hidden sm:inline">Admin & Governança</span>
            </Link>

            <div className="hidden items-center gap-2 border-l border-[#e7eef4] pl-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3fa] text-[#3979aa]">
                <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="hidden min-w-0 xl:block">
                <p className="max-w-[130px] truncate text-[11px] font-bold text-[#2b4863]">{context.user}</p>
                <p className="text-[10px] text-[#92a3b2]">{context.profile}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col gap-5 p-3 sm:p-5 lg:p-6 ${showWorkspace ? 'max-w-[1680px]' : 'max-w-[800px]'}`}>
        {showWorkspace && (
          <main className="agent-panel flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-white xl:h-[calc(100vh-120px)]">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8eff5] px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf6fd] text-[#2374b5]">
                  <BarChart3 size={20} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-[17px] font-extrabold tracking-[-0.025em] text-[#1d3c5d]">Workspace Analítico Protheus</h1>
                    <span className="hidden rounded-full bg-[#f0f8f3] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#37805d] sm:inline-flex">QueryRest Seguro</span>
                  </div>
                  <p className="mt-1 max-w-[680px] truncate text-[11px] text-[#899cac]">Resultados consolidados em tempo real com governança e auditoria</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsLogMode(true)} className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#e1eaf2] bg-white px-3 text-[11px] font-semibold text-[#66829b] transition-colors hover:border-[#bfd8eb] hover:bg-[#f7fbfe] hover:text-[#2876b8] sm:flex">
                  <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Diagnóstico Live
                </button>
                <button type="button" onClick={() => { setResult(null); setIsLogMode(false); }} className="h-9 rounded-xl border border-[#e1eaf2] bg-white px-3 text-[11px] font-semibold text-[#66829b] transition-colors hover:border-[#bfd8eb] hover:bg-[#f7fbfe] hover:text-[#2876b8]">
                  Voltar ao chat
                </button>
              </div>
            </header>

            <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#eef3f7] bg-[#fcfdff] px-5 py-3 sm:px-7">
              <ContextChip icon={CalendarDays} label="Ambiente" value={context.environment} />
              <ContextChip icon={Building2} label="Empresa" value={context.company} />
              <ContextChip icon={MapPin} label="Filial" value={context.branch} />
              <ContextChip icon={FileText} label="Módulo" value={context.module} />
            </div>

            <div className="agent-surface min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#fbfdff]">
              {isLogMode ? (
                <LogViewer onClose={() => setIsLogMode(false)} />
              ) : result ? (
                <StructuredResultPanel result={result} embedded onClose={() => setResult(null)} />
              ) : null}
            </div>
          </main>
        )}

        {!showWorkspace && (
          <aside className="agent-panel flex min-h-[560px] w-full min-w-0 flex-col overflow-hidden rounded-3xl border bg-white shadow-xl">
            <header className="flex shrink-0 items-center justify-between border-b border-[#e8eff5] px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf6fd] text-[#2679bd]">
                  <Bot size={20} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-extrabold tracking-[-0.015em] text-[#203e5e]">Copiloto Protheus</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#91a2b1]">Assistente inteligente para consultas ao ERP</p>
                </div>
              </div>
              <button type="button" onClick={startNewConversation} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce8f1] bg-white px-3 text-[11px] font-bold text-[#52718e] transition-colors hover:border-[#bad6ec] hover:bg-[#f5fbff] hover:text-[#2476bd]" aria-label="Iniciar nova conversa">
                <Plus size={14} strokeWidth={2} aria-hidden="true" /> Nova Consulta
              </button>
            </header>

            <div className="agent-surface min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-5">
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#e8f0f5] bg-[#fbfdff] px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${state.ready ? 'bg-[#31ab6c] shadow-[0_0_0_4px_rgba(49,171,108,0.12)]' : 'bg-[#d7a343] shadow-[0_0_0_4px_rgba(215,163,67,0.12)]'}`} aria-hidden="true" />
                  <span className="truncate text-[11px] font-semibold text-[#55718a]">{state.message}</span>
                </div>
                <span className="shrink-0 rounded-md bg-[#edf5fd] px-2 py-0.5 text-[10px] font-bold text-[#2b7bbd]">Módulo: {context.module}</span>
              </div>

              {messages.length <= 1 && !selected && !isLogMode && (
                <div className="mb-5 rounded-[22px] border border-[#e7eff5] bg-gradient-to-br from-[#f9fcff] to-[#f4f9fd] p-5">
                  <p className="text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-[#254864]">Olá! O que deseja analisar hoje no Protheus?</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#8297aa]">Selecione uma sugestão rápida abaixo ou digite sua pergunta em linguagem natural.</p>
                </div>
              )}

              {messages.length <= 1 && !selected && !isLogMode && (
                <div className="mb-5">
                  <SuggestionCards items={suggestions} disabled={loading} onPick={(item) => send(item.title)} />
                </div>
              )}

              {history.length > 0 && !isLogMode && (
                <details className="group mb-5 rounded-2xl border border-[#e8eff5] bg-[#fcfdff]" open={messages.length > 1}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#91a3b2]">
                    <span className="flex items-center gap-2"><History size={14} strokeWidth={1.8} aria-hidden="true" /> Histórico de Consultas</span>
                    <ChevronDown size={14} className="transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
                  </summary>
                  <div className="space-y-1 border-t border-[#edf2f6] px-2.5 py-2.5">
                    {history.slice(0, 5).map(item => (
                      <button key={item.id} type="button" onClick={() => selectConversation(item)} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] transition-colors ${selected?.id === item.id ? 'bg-[#eaf4fc] font-bold text-[#2476bd]' : 'text-[#607992] hover:bg-[#f1f7fb]'}`}>
                        <MessageSquarePlus size={13} className="shrink-0" strokeWidth={1.8} aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}

              <Conversation messages={messages} />
              {loading && (
                <div className="mt-3 flex items-center gap-2.5 text-[12px] text-[#7790a9]" aria-live="polite">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d7e8f6] bg-[#edf6fd] text-[#2b78bc]"><Bot size={16} className="animate-pulse" strokeWidth={1.8} aria-hidden="true" /></span>
                  <span className="rounded-2xl rounded-bl-md border border-[#e1eaf2] bg-white px-4 py-2.5 shadow-[0_3px_12px_rgba(49,84,117,0.05)]">Consultando dados no AppServer Protheus…</span>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#e6eef5] bg-white px-4 pb-4 pt-3 sm:px-5">
              <Composer disabled={loading} onSend={send} placeholder="Ex.: Faturamento por filial, títulos vencendo, top produtos..." />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#9aaabd]"><ShieldCheck size={12} strokeWidth={1.8} aria-hidden="true" /> Consultas somente leitura via QueryRest Protheus com validação de governança.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

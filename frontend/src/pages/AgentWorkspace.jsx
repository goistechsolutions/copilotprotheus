import { useEffect, useMemo, useState } from 'react';
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
  { title: 'Faturamento do mês', subtitle: 'Consolidar dados por filial' },
  { title: 'Títulos vencendo na semana', subtitle: 'Consultar contas a pagar' },
  { title: 'Top 5 produtos', subtitle: 'Identificar itens mais vendidos' },
  { title: 'Clientes com risco', subtitle: 'Analisar inadimplência' },
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
    tenant_id: params.get('tenant_id') || params.get('tenant') || '',
    company: params.get('company') || '',
    branch: params.get('branch') || '',
    user: params.get('user') || '',
    profile: params.get('profile') || 'Negócio',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || '',
    module: params.get('module') || '',
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
      ? 'Contexto do Protheus identificado.'
      : 'Copilot disponível sem contexto validado do Protheus.',
  });

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: hasContext
        ? 'Pronto. Posso ajudar com consultas, análises e relatórios.'
        : 'Pronto. Posso ajudar, mas preciso de um contexto validado do Protheus para consultar dados reais.',
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
      } else {
        setMessages([{ role: 'assistant', text: hasContext ? 'Pronto. Posso ajudar com consultas, análises e relatórios.' : 'Pronto. Posso ajudar, mas preciso de um contexto validado do Protheus para consultar dados reais.' }]);
        setSelected(null);
        setResult(null);
      }
    } catch {
      // O backend continuará usando o conversation_id da sessão atual.
    }
  }, [historyStorageKey, conversationId, hasContext]);

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

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-result-state', open: Boolean(result) }, '*');
    }
  }, [result]);

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
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          text: `Consulta bloqueada: contexto do Protheus incompleto (${missingContext.join(', ')}). Abra o Copilot dentro do ERP com o ambiente, empresa, filial e módulo selecionados.`,
        },
      ]);
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
      // O histórico do backend segue disponível mesmo sem localStorage.
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
      // Sem persistência local, o id ainda permanece válido nesta sessão.
    }
    setMessages([{ role: 'assistant', text: hasContext ? 'Nova conversa iniciada. Como posso ajudar?' : 'Nova conversa iniciada. Valide o contexto do Protheus antes de consultar dados reais.' }]);
    setResult(null);
    setSelected(null);
    setIsLogMode(false);
  };

  const contextSummary = [context.tenant_id, context.environment, context.company, context.branch, context.module].filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#edf3f8] font-sans text-[#1d3c5d]">
      <header className="shrink-0 border-b border-[#dfe8f0] bg-white/95 shadow-[0_1px_10px_rgba(44,78,108,0.04)] backdrop-blur">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1680px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2.5 pr-1 sm:pr-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf6fd] text-[#206aa7]">
              <Sparkles size={19} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <span className="text-[20px] font-extrabold tracking-[-0.04em] text-[#16466e]">Protheus</span>
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <div className="flex min-w-0 max-w-[230px] items-center gap-2 rounded-xl border border-[#e5edf4] bg-[#fbfdff] px-3 py-2">
              <Building2 size={15} className="shrink-0 text-[#7198b6]" strokeWidth={1.8} aria-hidden="true" />
              <span className="truncate text-[11px] font-semibold text-[#4c6881]">{context.tenant_id || 'Tenant não informado'}</span>
              <ChevronDown size={13} className="shrink-0 text-[#99aabd]" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 max-w-[210px] items-center gap-2 rounded-xl border border-[#e5edf4] bg-[#fbfdff] px-3 py-2">
              <MapPin size={15} className="shrink-0 text-[#7198b6]" strokeWidth={1.8} aria-hidden="true" />
              <span className="truncate text-[11px] font-semibold text-[#4c6881]">{context.branch || 'Filial não informada'}</span>
              <ChevronDown size={13} className="shrink-0 text-[#99aabd]" aria-hidden="true" />
            </div>
            <div className="ml-2 flex min-w-0 max-w-[280px] items-center gap-2 rounded-xl border border-[#e8eef4] bg-[#f8fbfd] px-3 py-2 text-[#9aaabd]">
              <Search size={15} strokeWidth={1.8} aria-hidden="true" />
              <span className="truncate text-[11px]">Buscar no sistema...</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <StatusPill ready={state.ready} />
            <button type="button" aria-label="Notificações" title="Notificações" className="relative hidden h-9 w-9 items-center justify-center rounded-xl text-[#6e8aa3] transition-colors hover:bg-[#f2f7fb] hover:text-[#2e76b5] sm:flex">
              <Bell size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e56f55]" aria-hidden="true" />
            </button>
            <div className="hidden items-center gap-2 border-l border-[#e7eef4] pl-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3fa] text-[#3979aa]">
                <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="max-w-[130px] truncate text-[11px] font-bold text-[#2b4863]">{context.user || 'Usuário atual'}</p>
                <p className="text-[10px] text-[#92a3b2]">{context.profile}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-4 p-3 sm:p-5 lg:p-6 xl:flex-row">
        <main className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-[#dfe9f1] bg-white shadow-[0_18px_50px_rgba(51,86,117,0.09)] xl:h-[calc(100vh-120px)]">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8eff5] px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf6fd] text-[#2374b5]">
                <BarChart3 size={20} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[17px] font-extrabold tracking-[-0.025em] text-[#1d3c5d]">Workspace analítico</h1>
                  <span className="hidden rounded-full bg-[#f0f8f3] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#37805d] sm:inline-flex">Somente leitura</span>
                </div>
                <p className="mt-1 max-w-[680px] truncate text-[11px] text-[#899cac]">Resultados reais do Protheus organizados para análise e decisão</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsLogMode(true)} className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#e1eaf2] bg-white px-3 text-[11px] font-semibold text-[#66829b] transition-colors hover:border-[#bfd8eb] hover:bg-[#f7fbfe] hover:text-[#2876b8] sm:flex">
                <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Diagnóstico
              </button>
              {result && !isLogMode && (
                <button type="button" onClick={() => setResult(null)} className="h-9 rounded-xl border border-[#e1eaf2] bg-white px-3 text-[11px] font-semibold text-[#66829b] transition-colors hover:border-[#bfd8eb] hover:bg-[#f7fbfe] hover:text-[#2876b8]">
                  Limpar painel
                </button>
              )}
            </div>
          </header>

          <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#eef3f7] bg-[#fcfdff] px-5 py-3 sm:px-7">
            <ContextChip icon={CalendarDays} label="Ambiente" value={context.environment} />
            <ContextChip icon={Building2} label="Empresa" value={context.company} />
            <ContextChip icon={MapPin} label="Filial" value={context.branch} />
            <ContextChip icon={FileText} label="Módulo" value={context.module} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#fbfdff]">
            {isLogMode ? (
              <LogViewer onClose={() => setIsLogMode(false)} />
            ) : result ? (
              <StructuredResultPanel result={result} embedded onClose={() => setResult(null)} />
            ) : (
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border border-[#e1edf5] bg-white text-[#8bb1cb] shadow-[0_16px_34px_rgba(45,87,122,0.09)]">
                  <BarChart3 size={31} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <p className="mt-6 text-[16px] font-extrabold tracking-[-0.015em] text-[#345670]">Seu painel aparecerá aqui</p>
                <p className="mt-2 max-w-[470px] text-[12px] leading-[1.75] text-[#8297aa]">Faça uma pergunta no Copiloto ao lado. As respostas retornadas pelo contexto real do Protheus serão exibidas com resumo, indicadores, tabelas e gráficos quando disponíveis.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {['Resumo executivo', 'Indicadores', 'Tabela filtrável', 'Gráficos', 'Exportação'].map(item => (
                    <span key={item} className="rounded-full border border-[#dfebf3] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#7892a8]">{item}</span>
                  ))}
                </div>
                {!hasContext && (
                  <div className="mt-7 flex max-w-[470px] items-start gap-2.5 rounded-2xl border border-[#f1dfb8] bg-[#fffaf0] px-4 py-3 text-left text-[11px] leading-relaxed text-[#8e6d34]">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    <span>O contexto ainda não está completo. A consulta será bloqueada até que tenant, ambiente, empresa, filial e módulo sejam validados.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="flex min-h-[560px] w-full min-w-0 flex-col overflow-hidden rounded-[26px] border border-[#dfe9f1] bg-white shadow-[0_18px_50px_rgba(51,86,117,0.09)] xl:h-[calc(100vh-120px)] xl:w-[420px] xl:shrink-0">
          <header className="flex shrink-0 items-center justify-between border-b border-[#e8eff5] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#edf6fd] text-[#2679bd]">
                <Bot size={20} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold tracking-[-0.015em] text-[#203e5e]">Protheus Copiloto</p>
                <p className="mt-0.5 truncate text-[10px] text-[#91a2b1]">Assistente para consultas seguras</p>
              </div>
            </div>
            <button type="button" onClick={startNewConversation} className="flex h-9 items-center gap-1.5 rounded-xl border border-[#dce8f1] bg-white px-3 text-[11px] font-bold text-[#52718e] transition-colors hover:border-[#bad6ec] hover:bg-[#f5fbff] hover:text-[#2476bd]" aria-label="Iniciar nova conversa">
              <Plus size={14} strokeWidth={2} aria-hidden="true" /> Nova
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-5">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#e8f0f5] bg-[#fbfdff] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${state.ready ? 'bg-[#31ab6c] shadow-[0_0_0_4px_rgba(49,171,108,0.12)]' : 'bg-[#d7a343] shadow-[0_0_0_4px_rgba(215,163,67,0.12)]'}`} aria-hidden="true" />
                <span className="truncate text-[11px] font-semibold text-[#55718a]">{state.message}</span>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-[#9aaabd]">{context.module || 'Sem módulo'}</span>
            </div>

            {messages.length <= 1 && !selected && !isLogMode && (
              <div className="mb-5 rounded-[22px] border border-[#e7eff5] bg-gradient-to-br from-[#f9fcff] to-[#f4f9fd] p-4 sm:p-5">
                <p className="text-[19px] font-extrabold leading-tight tracking-[-0.025em] text-[#254864]">Olá, como posso ajudar você hoje?</p>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8297aa]">Escolha uma sugestão ou escreva uma pergunta sobre o contexto ativo.</p>
              </div>
            )}

            {messages.length <= 1 && !selected && !isLogMode && (
              <div className="mb-5">
                <SuggestionCards items={suggestions} disabled={loading} onPick={(item) => send(item.title)} />
              </div>
            )}

            {history.length > 0 && !isLogMode && (
              <details className="group mb-5 rounded-2xl border border-[#e8eff5] bg-[#fcfdff]" open={messages.length > 1}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#91a3b2] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><History size={14} strokeWidth={1.8} aria-hidden="true" /> Conversas recentes</span>
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
                <span className="rounded-2xl rounded-bl-md border border-[#e1eaf2] bg-white px-4 py-2.5 shadow-[0_3px_12px_rgba(49,84,117,0.05)]">Consultando o Protheus…</span>
              </div>
            )}
            {selected && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#cfe3f4] bg-[#f0f7fd] px-3 py-2.5 text-[11px] text-[#3d6f98]">
                <ChevronDown size={14} className="rotate-[-90deg]" aria-hidden="true" />
                Histórico: <strong className="truncate">{selected.title}</strong>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#e6eef5] bg-white px-4 pb-4 pt-3 sm:px-5">
            <Composer disabled={loading} onSend={send} placeholder="Faça sua pergunta sobre o Protheus..." />
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#9aaabd]"><ShieldCheck size={12} strokeWidth={1.8} aria-hidden="true" /> Consultas somente leitura, limitadas ao contexto ativo.</p>
            {contextSummary && <span className="sr-only">Contexto atual: {contextSummary}</span>}
          </div>
        </aside>
      </div>
    </div>
  );
}

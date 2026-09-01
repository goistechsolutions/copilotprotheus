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
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  LayoutDashboard,
  LayoutList,
  Lightbulb,
  MapPin,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Table,
  Terminal,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';
import Composer from '../components/Composer';
import Conversation from '../components/Conversation';
import LogViewer from '../components/LogViewer';
import StructuredResultPanel from '../components/StructuredResultPanel';

const analystStarterCards = [
  {
    id: 'fat',
    title: 'Faturamento do Mês',
    subtitle: 'Totais faturados por filial, clientes e notas de saída (SF2/SD2)',
    category: 'Vendas & Faturamento',
    icon: TrendingUp,
    color: 'from-blue-600 to-indigo-600',
    prompt: 'Qual o faturamento consolidado deste mês por filial e principais clientes?',
  },
  {
    id: 'fin',
    title: 'Títulos a Pagar & Compromissos',
    subtitle: 'Posição de contas a pagar com vencimentos na semana (SE2)',
    category: 'Financeiro',
    icon: CreditCard,
    color: 'from-emerald-600 to-teal-600',
    prompt: 'Liste os títulos a pagar vencendo nos próximos 7 dias com fornecedor e valor.',
  },
  {
    id: 'est',
    title: 'Top Produtos Mais Vendidos',
    subtitle: 'Curva ABC de itens faturados com quantidade e valor total (SD2/SB1)',
    category: 'Estoque & Vendas',
    icon: Package,
    color: 'from-amber-500 to-orange-600',
    prompt: 'Quais são os 10 produtos mais vendidos no período com código, descrição e valor?',
  },
  {
    id: 'rec',
    title: 'Inadimplência & Títulos em Aberto',
    subtitle: 'Clientes com títulos vencidos no contas a receber (SE1/SA1)',
    category: 'Crédito & Cobrança',
    icon: TrendingDown,
    color: 'from-rose-600 to-pink-600',
    prompt: 'Quais clientes possuem títulos vencidos em aberto no contas a receber?',
  },
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
    profile: params.get('profile') || 'Negócio',
    session_id: params.get('session_id') || '',
    environment: params.get('environment_code') || params.get('environment') || 'c8te0u_prod',
    module: params.get('module') || 'SIGAFAT',
  };
}

export default function AgentWorkspace() {
  const [externalContext, setExternalContext] = useState(readContextFromUrl());
  const [viewTab, setViewTab] = useState('dashboard'); // 'dashboard' | 'chat' | 'log'
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

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Sou o **AI Data Analyst** do Protheus. Posso analisar dados de faturamento, financeiro, compras e estoque com consultas em tempo real via QueryRest Oracle.',
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
    } catch {}
  }, [historyStorageKey, conversationId]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({ role: item.role, text: item.text.trim().slice(0, 4000) }));
    if (!textMessages.some(item => item.role === 'user')) return;

    setHistory((items) => {
      const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova análise';
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
      setViewTab('log');
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

      let replyMessage = 'Análise concluída com sucesso no ERP.';
      if (res.status === 'execution_failed') {
        replyMessage = `Falha na consulta Oracle: ${res.execution_error || 'Erro de execução.'}`;
      } else if (res.status === 'error') {
        replyMessage = `Bloqueio: ${res.error || res.summary || res.message || 'Contexto não autorizado.'}`;
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
        { role: 'assistant', text: `**Erro:** ${String(error.message || error)}` },
      ]);
    }

    setLoading(false);
  };

  const startNewAnalysis = () => {
    const nextConversationId = makeConversationId();
    setConversationId(nextConversationId);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, nextConversationId);
    } catch {}
    setMessages([{ role: 'assistant', text: 'Nova sessão iniciada. Escolha uma das análises recomendadas ou digite uma pergunta de negócio.' }]);
    setResult(null);
    setSelected(null);
    setViewTab('dashboard');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100/70 font-sans text-slate-800 antialiased">
      {/* Google AI Studio Data Analyst Top Bar */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-xs">
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1840px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Model */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-black tracking-tight text-slate-900">
                  AI Data <span className="text-indigo-600">Analyst</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                  <Zap size={10} className="fill-indigo-600 text-indigo-600" />
                  Gemini 2.0 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                TOTVS Protheus ERP • Oracle Cloud Analytics
              </p>
            </div>
          </div>

          {/* Context Chips */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <Building2 size={13} className="text-indigo-600" />
              <span className="text-slate-400">Tenant:</span>
              <strong className="text-slate-700">{context.tenant_id}</strong>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <MapPin size={13} className="text-indigo-600" />
              <span className="text-slate-400">Filial:</span>
              <strong className="text-slate-700">{context.branch}</strong>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <FileText size={13} className="text-indigo-600" />
              <span className="text-slate-400">Módulo:</span>
              <strong className="text-slate-700">{context.module}</strong>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Conectado ao ERP</span>
            </div>

            <button
              type="button"
              onClick={startNewAnalysis}
              className="flex h-8.5 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3.5 text-[11px] font-bold text-white shadow-sm hover:from-blue-500 hover:to-purple-500 transition-all active:scale-95"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Nova Análise</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Layout: Left Chat Stream (35%) + Right Data Analyst Dashboard (65%) */}
      <div className="mx-auto flex w-full max-w-[1840px] flex-1 min-h-0 p-3 sm:p-5 lg:p-6 gap-6 flex-col lg:flex-row">
        {/* Left Column: AI Data Analyst Conversational Stream & Composer */}
        <aside className="flex flex-col w-full lg:w-[420px] xl:w-[460px] shrink-0 rounded-3xl border border-slate-200/90 bg-white shadow-md overflow-hidden min-h-[580px] lg:h-[calc(100vh-120px)]">
          {/* Chat Stream Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-slate-800">Chat do Analista</h3>
                <p className="text-[10px] text-slate-400">Contexto {context.module} • Filial {context.branch}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewTab(t => t === 'log' ? 'dashboard' : 'log')}
              className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold transition-all ${
                viewTab === 'log'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Terminal size={12} />
              <span>Logs / SQL</span>
            </button>
          </div>

          {/* Chat Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* History Selector if exists */}
            {history.length > 1 && (
              <details className="group rounded-2xl border border-slate-200/80 bg-slate-50/70">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <History size={12} className="text-indigo-600" />
                    Histórico de Análises ({history.length})
                  </span>
                  <ChevronDown size={12} className="transition-transform group-open:rotate-180 text-slate-400" />
                </summary>
                <div className="space-y-1 border-t border-slate-200/60 p-2 max-h-[130px] overflow-y-auto">
                  {history.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setConversationId(item.id);
                        if (item.messages) setMessages(item.messages);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                        conversationId === item.id 
                          ? 'bg-indigo-100 font-bold text-indigo-800' 
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <MessageSquare size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                </div>
              </details>
            )}

            <Conversation messages={messages} />

            {loading && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/70 text-[12px] text-indigo-900 animate-pulse">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                  <Sparkles size={16} />
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-indigo-950">AI Data Analyst em execução...</p>
                  <p className="text-[10px] text-indigo-600">Consultando dicionário e executando SQL Oracle no Protheus.</p>
                </div>
              </div>
            )}
          </div>

          {/* Floating Composer */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-100">
            <Composer disabled={loading} onSend={send} placeholder="Faça uma pergunta sobre dados do Protheus..." />
          </div>
        </aside>

        {/* Right Column: AI Data Analyst Interactive Workspace & Dashboard */}
        <main className="flex-1 flex flex-col min-w-0 rounded-3xl border border-slate-200/90 bg-white shadow-md overflow-hidden min-h-[580px] lg:h-[calc(100vh-120px)]">
          {viewTab === 'log' ? (
            <LogViewer onClose={() => setViewTab('dashboard')} />
          ) : result ? (
            <StructuredResultPanel result={result} embedded onClose={() => setResult(null)} />
          ) : (
            /* Initial AI Data Analyst Dashboard Overview */
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
              {/* Dashboard Banner */}
              <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-6 shadow-xs">
                <div className="flex items-center gap-2.5 text-indigo-800 font-extrabold text-base mb-1.5">
                  <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                  <span>Painel do AI Data Analyst</span>
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed max-w-2xl">
                  Selecione uma das análises corporativas abaixo ou faça qualquer pergunta no chat ao lado para consultar dados reais do ERP Protheus com agregação analítica, KPIs e gráficos automáticos.
                </p>
              </div>

              {/* Starter Analysis Cards Grid */}
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Análises Recomendadas para {context.module}</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">Clique para executar</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analystStarterCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => send(card.prompt)}
                        className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 text-left shadow-2xs hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200 active:scale-[0.99]"
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-sm transition-transform group-hover:scale-105`}>
                          <Icon size={20} strokeWidth={2} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            {card.category}
                          </span>
                          <strong className="block text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {card.title}
                          </strong>
                          <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
                            {card.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Analytics Lineage & Governance Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Governança & Rastreabilidade de Dados</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-slate-600">
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                    <p className="font-bold text-slate-800">1. Consulta Nativa</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Executa SQL Oracle puro via endpoint seguro /QueryRest.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                    <p className="font-bold text-slate-800">2. Zero Alucinação</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Apenas dados reais do banco de dados são apresentados.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                    <p className="font-bold text-slate-800">3. Isolamento RBAC</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Restrição estrita por tenant, empresa, filial e permissões.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

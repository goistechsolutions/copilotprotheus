import { useEffect, useMemo, useState, useRef } from 'react';
import {
  BarChart3,
  Bell,
  Database,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import {
  downloadStructuredReport,
  exportStructuredReport,
  askAgent,
  waitForAgentTask,
} from '../services/api';
import { getTaskStatusLabel } from '../services/taskStatus';
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

function hasValidResult(value) {
  return Boolean(
    value &&
    Array.isArray(value.rows) &&
    value.rows.length > 0,
  );
}

export default function AgentWorkspace({ onNavigateToDashboard, externalContext: propContext }) {
  const [externalContext, setExternalContext] = useState(propContext || readContextFromUrl());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem('copilot.theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeNav, setActiveNav] = useState('chat-hub');
  const [conversationId, setConversationId] = useState(() => {
    const initialContext = readContextFromUrl();
    return initialContext.session_id || makeConversationId();
  });
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const abortRef = useRef(null);

  useEffect(() => {
    if (propContext) setExternalContext(propContext);
  }, [propContext]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try {
      window.localStorage.setItem('copilot.theme', isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  const context = useMemo(() => ({
    tenant_id: externalContext.tenant_id || null,
    company: externalContext.company || null,
    branch: externalContext.branch || null,
    user: externalContext.user || null,
    profile: externalContext.profile || null,
    session_id: externalContext.session_id || null,
    environment: externalContext.environment || null,
    module: externalContext.module || null,
  }), [externalContext]);

  const historyStorageKey = useMemo(
    () => `copilot.conversations:${conversationKey(context)}`,
    [context],
  );

  useEffect(() => {
    abortRef.current?.abort();
    setTask(null);
    setResult(null);
  }, [historyStorageKey]);

  useEffect(() => {
    const stored = safeStorageRead(historyStorageKey, []);
    const conversations = Array.isArray(stored) ? stored : [];
    try {
      const activeId = window.localStorage.getItem(`${historyStorageKey}:active`) || conversationId;
      if (activeId) setConversationId(activeId);
      if (!window.localStorage.getItem(`${historyStorageKey}:active`)) {
        window.localStorage.setItem(`${historyStorageKey}:active`, activeId);
      }
      const active = conversations.find(item => item.id === activeId);
      if (active?.messages?.length) setMessages(active.messages);
      setResult(hasValidResult(active?.result) ? active.result : null);
    } catch {}
  }, [historyStorageKey, conversationId]);

  useEffect(() => {
    const textMessages = messages
      .filter(item => ['user', 'assistant'].includes(item.role) && item.text?.trim())
      .map(item => ({
        role: item.role,
        text: item.text.trim().slice(0, 4000),
        result: hasValidResult(item.result) ? item.result : null,
        userPrompt: item.userPrompt || null,
      }));
    if (!textMessages.some(item => item.role === 'user')) return;

    const stored = safeStorageRead(historyStorageKey, []);
    const title = textMessages.find(item => item.role === 'user')?.text.slice(0, 52) || 'Nova consulta';
    safeStorageWrite(historyStorageKey, [
      { id: conversationId, title, date: 'Agora', messages: textMessages, result: hasValidResult(result) ? result : null },
      ...stored.filter(item => item.id !== conversationId),
    ].slice(0, 20));
  }, [messages, conversationId, historyStorageKey, result]);

  useEffect(() => {
    const stored = safeStorageRead(historyStorageKey, []);
    setHistoryItems(Array.isArray(stored) ? stored : []);
  }, [historyStorageKey, messages, result, conversationId]);

  const handleSelectConversation = item => {
    if (!item?.id) return;
    setConversationId(item.id);
    setMessages(Array.isArray(item.messages) ? item.messages : []);
    setResult(hasValidResult(item.result) ? item.result : null);
    setShowHistory(false);
    try {
      window.localStorage.setItem(`${historyStorageKey}:active`, item.id);
    } catch {}
  };

  const handleExportConversationPdf = async () => {
    if (!hasValidResult(result)) return;
    const rows = result.rows;
    const columns = Array.isArray(result.columns) && result.columns.length
      ? result.columns
      : Object.keys(rows[0]);
    try {
      const metadata = await exportStructuredReport('pdf', {
        title: result.summary || 'Relatório do Copilot Protheus',
        tenant_code: context.tenant_id,
        environment_code: context.environment,
        company_id: context.company || null,
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

  const send = async text => {
    if (!text?.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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

    setMessages(current => [...current, { role: 'user', text }]);
    setResult(null);
    setTask(null);
    setLoading(true);

    if (missingContext.length) {
      const contextError = {
        status: 'error',
        error_source: 'context',
        error_code: 'CONTEXT_NOT_VALIDATED',
        message: `Contexto do Protheus não validado. Campos ausentes: ${missingContext.join(', ')}.`,
        retryable: false,
      };
      setResult(null);
      setTask({
        status: 'validation_failed',
        error: contextError.message,
        errorCode: contextError.error_code,
        correlationId: null,
      });
      setMessages(current => [...current, { role: 'assistant', text: contextError.message, status: 'error' }]);
      setLoading(false);
      return;
    }

    try {
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

      const accepted = await askAgent(payload, { signal: controller.signal });
      const response = accepted.task_id
        ? await waitForAgentTask(accepted.task_id, { signal: controller.signal })
        : accepted;
      const normalized = normalizeAgentResult(response);

      if (normalized.status === 'error') {
        setResult(null);
        setTask({
          status: response.status || 'error',
          error: normalized.message,
          errorCode: normalized.errorCode,
          correlationId: normalized.correlationId,
        });
        setMessages(current => [...current, {
          role: 'assistant',
          text: normalized.message,
          status: 'error',
          errorCode: normalized.errorCode,
          domainDiagnostic: normalized.domainDiagnostic,
          result: null,
          correlationId: normalized.correlationId,
          userPrompt: text,
        }]);
        return;
      }

      const safeResult = hasValidResult(normalized.result) ? normalized.result : null;
      setResult(safeResult);
      setTask({
        status: 'success',
        error: null,
        errorCode: null,
        correlationId: normalized.correlationId,
      });
      setMessages(current => [...current, {
        role: 'assistant',
        text: normalized.message || 'Análise executiva concluída com sucesso no Protheus.',
        status: 'success',
        result: safeResult,
        correlationId: normalized.correlationId,
        userPrompt: text,
      }]);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setResult(null);
      setTask({ status: 'execution_failed', error: String(error.message || error) });
      setMessages(current => [...current, {
        role: 'assistant',
        status: 'error',
        text: `**Erro:** ${String(error.message || error)}`,
      }]);
    } finally {
      setLoading(false);
    }
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

  const isIframe = typeof window !== 'undefined' && window.parent && window.parent !== window;
  const showWorkspace = hasValidResult(result);
  const userName = context.user ? context.user.split(' ')[0] : 'Executivo';

  return (
    <div className="min-h-screen w-full bg-[#F5FAFF] dark:bg-[#0F172A] flex font-sans text-[#171C20] dark:text-[#F8FAFC] antialiased">
      {!isIframe && (
        <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-white dark:bg-[#1E293B] z-50 flex flex-col border-r border-[#E2E8F0] dark:border-slate-800">
          <div className="p-6 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004FCE] text-white flex items-center justify-center"><Sparkles size={20} /></div>
            <div className="hidden lg:block"><span className="font-bold text-[18px] text-[#004FCE]">Copiloto</span><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">TOTVS Protheus</span></div>
          </div>
          <nav className="flex-1 px-3 space-y-1.5">
            {[['chat-hub', MessageSquare, 'Conversas'], ['analises', BarChart3, 'Análises'], ['erp-insights', Database, 'ERP Insights']].map(([id, Icon, label]) => (
              <button key={id} type="button" onClick={() => setActiveNav(id)} className={`w-full flex items-center px-4 py-3 rounded-xl ${activeNav === id ? 'bg-[#0F66FF] text-white' : 'text-slate-500 hover:bg-slate-100'}`}><Icon size={19} className="mr-3" /><span className="hidden lg:block text-[14px]">{label}</span></button>
            ))}
            {onNavigateToDashboard && <button type="button" onClick={onNavigateToDashboard} className="w-full flex items-center px-4 py-3 rounded-xl text-[#004FCE] bg-[#E0ECFF]"><LayoutDashboard size={19} className="mr-3" /><span className="hidden lg:block text-[14px]">Painel Executivo</span></button>}
          </nav>
          <div className="px-3 py-4 border-t border-slate-200"><button type="button" className="w-full flex items-center px-4 py-3 rounded-xl text-slate-500"><Settings size={19} className="mr-3" /><span className="hidden lg:block text-[14px]">Ajustes</span></button></div>
        </aside>
      )}

      <div className={`flex-1 flex flex-col min-h-screen ${!isIframe ? 'pl-20 lg:pl-64' : ''}`}>
        {!isIframe && <header className="h-16 bg-white/80 dark:bg-[#1E293B]/80 border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-[13px] font-semibold text-slate-500">Sistema Operacional</span><span className="hidden md:inline text-xs text-slate-500">Filial {context.branch || '—'} · {context.module || 'Módulo não identificado'}</span></div>
          <div className="flex items-center gap-4"><div className="hidden md:flex items-center bg-slate-100 px-3 py-1.5 rounded-full"><Search size={16} className="text-slate-400 mr-2" /><input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Pesquisar no ERP..." className="bg-transparent outline-none text-[13px] w-48" /></div><button type="button" onClick={() => setIsDarkMode(value => !value)} className="p-2 text-slate-500">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button><Bell size={18} className="text-slate-500" /><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-[#004FCE] text-white flex items-center justify-center text-xs font-bold">{context.user ? context.user.slice(0, 2).toUpperCase() : 'JS'}</div><span className="hidden xl:block text-xs font-bold">{context.user || 'Usuário não identificado'}</span></div></div>
        </header>}

        <main className={`flex-1 flex flex-col min-h-0 ${isIframe ? 'p-3 h-screen' : 'p-4 sm:p-6 lg:p-8'}`}>
          {!showWorkspace && !isIframe && <div className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto"><div className="text-center mb-8"><div className="flex items-center justify-center gap-2.5 mb-4"><div className="w-12 h-12 rounded-full bg-[#004FCE] text-white flex items-center justify-center"><Sparkles size={22} /></div><span className="w-2.5 h-2.5 rounded-full bg-green-500" /></div><h1 className="text-[32px] sm:text-[40px] font-bold">Olá, {userName}.<br /><span className="text-[20px] sm:text-[24px] font-semibold text-slate-500">Como posso ajudar com os dados do Protheus hoje?</span></h1></div><div className="w-full mb-8"><SuggestionCards disabled={loading} onPick={send} /></div><div className="w-full"><Composer disabled={loading} onSend={send} placeholder="Pergunte sobre clientes, pedidos, financeiro, faturamento..." /></div></div>}

          {(showWorkspace || isIframe) && <div className={`flex-1 flex ${(!isIframe || result) ? 'flex-col lg:flex-row gap-4 sm:gap-6' : 'flex-col'} items-stretch min-h-0 h-full`}>
            {showWorkspace && !isIframe && <section className="flex-1 lg:w-[70%] min-w-0 flex flex-col"><StructuredResultPanel result={result} context={context} onClose={() => setResult(null)} /></section>}
            <aside className={`flex flex-col shrink-0 overflow-hidden ${isIframe ? 'w-full h-full p-2.5 bg-white dark:bg-[#1E293B] rounded-xl' : 'stitch-card p-4 sm:p-5 w-full lg:w-[30%] min-h-[580px] h-[calc(100vh-8rem)] sticky top-20'}`}>
              <div className="p-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-xl mb-3"><div className="flex items-center gap-1.5 flex-wrap"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-[10px] font-semibold"><Database size={10} />PROTHEUS - {context.branch || 'Filial não identificada'}</span><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-[10px] font-semibold"><User size={10} />{context.user || 'Usuário não identificado'}</span><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[10px] font-semibold text-[#004FCE]">{context.module || 'Módulo não identificado'}</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => setShowHistory(value => !value)} title="Histórico" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 border border-slate-200"><History size={13} /><span className="hidden sm:inline">Histórico</span></button>{hasValidResult(result) && <button type="button" onClick={handleExportConversationPdf} title="Exportar PDF" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#004FCE] border border-blue-200"><FileText size={13} /><span className="hidden sm:inline">PDF</span></button>}<button type="button" onClick={handleNewConversation} title="Nova consulta" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#004FCE] border border-blue-200"><Plus size={13} /><span className="hidden sm:inline">Nova Consulta</span></button></div></div>
              {showHistory && <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="flex items-center justify-between px-3 py-2 border-b border-slate-200"><span className="text-[11px] font-bold">Histórico de conversas</span><span className="text-[10px] text-slate-400">{historyItems.length} registro(s)</span></div><div className="max-h-48 overflow-y-auto">{historyItems.length === 0 ? <p className="px-3 py-4 text-[11px] text-slate-500">Nenhuma conversa persistida neste contexto.</p> : historyItems.map(item => <button type="button" key={item.id} onClick={() => handleSelectConversation(item)} className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-blue-50 ${item.id === conversationId ? 'bg-blue-50/70' : ''}`}><span className="block text-[11px] font-semibold truncate">{item.title || 'Consulta sem título'}</span><span className="block text-[10px] text-slate-400 mt-0.5">{item.date || 'Histórico local'}</span></button>)}</div></div>}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">{messages.length === 0 && <div className="space-y-4 py-2"><p className="text-[12px] font-medium text-slate-500">Pronto para consultar. Escolha uma sugestão ou faça uma pergunta:</p><SuggestionCards disabled={loading} onPick={send} /></div>}<Conversation messages={messages} context={context} onNavigateToDashboard={onNavigateToDashboard} />{loading && <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 text-[12px] text-[#004FCE] animate-pulse"><Sparkles size={15} /><span>{task ? getTaskStatusLabel(task.status) : 'Consultando dados no Protheus via Oracle QueryRest...'}</span></div>}</div>
              <div className="pt-2.5 border-t border-slate-200 mt-2"><Composer disabled={loading} onSend={send} placeholder="Pergunte sobre seus dados..." /></div>
            </aside>
          </div>}
        </main>
      </div>
    </div>
  );
}

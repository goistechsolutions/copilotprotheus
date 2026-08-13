import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import ContextBanner from '../components/ContextBanner';
import Composer from '../components/Composer';
import HistoryRail from '../components/HistoryRail';
import SuggestionCards from '../components/SuggestionCards';
import Conversation from '../components/Conversation';
import ResultPane from '../components/ResultPane';
import LogViewer from '../components/LogViewer';

const suggestions = [
  { title: 'Faturamento do mês', subtitle: 'por filial' },
  { title: 'Títulos vencendo na semana', subtitle: 'contas a pagar' },
  { title: 'Top 5 produtos', subtitle: 'mais vendidos' },
  { title: 'Clientes com risco', subtitle: 'inadimplência' },
];

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
    ready: true,
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

  const [history, setHistory] = useState([
    { title: 'Faturamento do mês', date: 'Hoje' },
    { title: 'Títulos vencendo', date: 'Ontem' },
  ]);

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
      ready: true,
      message: readyMessage,
    });
  }, [hasContext]);

  const send = async (text) => {
    if (!text?.trim()) return;

    if (text.trim() === '/log') {
       setIsLogMode(true);
       return;
    }

    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);

    try {
      const payload = {
        ...context,
        company_id: context.company,
        empresa: context.company,
        filial: context.branch,
        request_id: `REQ-${Date.now()}`,
        prompt: text,
        execute: true,
      };

      const res = await api.askAgent(payload);

      setResult(res);
      
      let replyMessage = 'Consulta concluída.';
      if (res.summary) replyMessage = res.summary;
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

  return (
    <div className="flex flex-col xl:flex-row h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
      <div className="hidden md:flex">
        <HistoryRail
          items={history}
          onSelect={setSelected}
          onNew={() => {
            setMessages([{ role: 'assistant', text: 'Nova conversa iniciada.' }]);
            setResult(null);
            setSelected(null);
          }}
        />
      </div>

      <main className="flex-1 min-w-0 flex flex-col bg-white shadow-xl z-10 overflow-hidden relative border-r border-slate-100">
        
        <header className="px-6 pt-6 pb-2 bg-white flex flex-col items-center xl:items-start z-10">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bot"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
             </div>
             <h1 className="text-xl font-bold text-slate-800">Protheus Copiloto</h1>
          </div>
          <ContextBanner state={state} />
          
          <h2 className="text-2xl mt-4 text-slate-700">
            Olá, como posso ajudar você hoje?
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col gap-8 scroll-smooth">
          <SuggestionCards
            items={suggestions}
            disabled={loading}
            onPick={(it) => send(it.title)}
          />

          <Conversation messages={messages} />

          {selected && (
            <div className="p-4 mx-auto w-full max-w-3xl bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
              Histórico selecionado: {selected.title}
            </div>
          )}
        </div>

        <div className="p-4 bg-white shrink-0">
          <Composer
            disabled={loading}
            onSend={send}
            placeholder="Faça sua pergunta sobre o Protheus... (ou digite /log)"
          />
        </div>
      </main>

      <aside className={`w-full xl:w-[420px] shrink-0 bg-white border-t xl:border-t-0 xl:border-l border-slate-200 overflow-y-auto flex-col h-1/2 xl:h-auto ${result || isLogMode ? 'flex' : 'hidden xl:flex'}`}>
        {isLogMode ? (
           <LogViewer onClose={() => setIsLogMode(false)} />
        ) : (
           <ResultPane result={result} />
        )}
      </aside>
    </div>
  );
}
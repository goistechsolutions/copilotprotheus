import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import ContextBanner from '../components/ContextBanner';
import Composer from '../components/Composer';
import HistoryRail from '../components/HistoryRail';
import SuggestionCards from '../components/SuggestionCards';
import Conversation from '../components/Conversation';
import ResultPane from '../components/ResultPane';

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

  const context = useMemo(() => ({
    tenant_id: externalContext.tenant_id || '',
    company: externalContext.company || '',
    branch: externalContext.branch || '',
    user: externalContext.user || '',
    profile: externalContext.profile || 'Negócio',
    session_id: externalContext.session_id || '',
    environment: externalContext.environment || '',
    module: externalContext.module || '',
  }), [externalContext]);

  const [state, setState] = useState({ ready: true, message: 'Contexto carregado (Validação desabilitada)' });
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Aguardando contexto do Protheus.' }]);
  const [history, setHistory] = useState([]);
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
    const hasMinimumContext =
      !!context.tenant_id &&
      (!!context.company || !!context.branch || !!context.user);

    if (!hasMinimumContext) {
      // setState({ ready: false, message: 'Aguardando contexto do Protheus...' });
      // Removed block to allow interaction without validated context
      // return;
    }

    let alive = true;

    (async () => {
      try {
        const res = await api.validateContext(context);
        if (!alive) return;

        setState({
          ready: !!res.ready,
          message: res.message || (res.ready ? 'Contexto pronto' : 'Contexto indisponível'),
        });

        if (res.ready) {
          setMessages([{ role: 'assistant', text: 'Pronto. Posso ajudar com consultas, análises e relatórios.' }]);
          setHistory(
            res.history || [
              { title: 'Faturamento do mês', date: 'Hoje' },
              { title: 'Títulos vencendo', date: 'Ontem' },
            ]
          );
        }
      } catch (e) {
        if (!alive) return;
        setState({ ready: false, message: 'Falha ao validar contexto do Protheus' });
      }
    })();

    return () => {
      alive = false;
    };
  }, [context]);

  const send = async (text) => {
    if (!text?.trim()) return;

    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);

    try {
      const payload = {
        ...context,
        request_id: `REQ-${Date.now()}`,
        prompt: text,
      };

      const res = await api.askAgent(payload);
      setResult(res);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.answer || res.summary || 'Consulta concluída.' },
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
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
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

      <main className="flex-1 min-w-0 flex flex-col bg-slate-800 shadow-xl z-10 overflow-hidden relative">
        <ContextBanner state={state} />

        <header className="px-4 md:px-8 py-5 text-center border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-sm z-10">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-100">Workspace Analítico</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Aqui aparecem os resultados gráficos e tabulares das suas requisições.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-6 scroll-smooth">
          <SuggestionCards
            items={suggestions}
            disabled={loading}
            onPick={(it) => send(it.title)}
          />

          <Conversation messages={messages} />

          {selected && (
            <div className="p-4 mx-auto w-full max-w-3xl bg-blue-500/10 text-blue-400 rounded-lg text-sm border border-blue-500/20">
              Histórico selecionado: {selected.title}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0">
          <Composer
            disabled={loading}
            onSend={send}
            placeholder={'Faça sua pergunta sobre o Protheus...'}
          />
        </div>
      </main>

      <aside className="w-[380px] xl:w-[420px] shrink-0 bg-slate-900 border-l border-slate-700 overflow-y-auto flex-col hidden xl:flex">
        <ResultPane result={result} />
      </aside>
    </div>
  );
}
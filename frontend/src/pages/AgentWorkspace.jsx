import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import SideRail from '../components/SideRail';
import TopContextStrip from '../components/TopContextStrip';
import QuickSuggestions from '../components/QuickSuggestions';
import ConversationList from '../components/ConversationList';
import ResultsArea from '../components/ResultsArea';
import LoadingOverlay from '../components/LoadingOverlay';
import ContextStatus from '../components/ContextStatus';
import { Send, Loader2 } from 'lucide-react';

const suggestions = [
  { title: 'Faturamento do mês', subtitle: 'Resumo por filial e período' },
  { title: 'Títulos em aberto', subtitle: 'Financeiro e vencimentos' },
  { title: 'Top clientes', subtitle: 'Análise de concentração' },
  { title: 'Produtos mais vendidos', subtitle: 'Ranking por quantidade' },
];

export default function AgentWorkspace() {
  const [context, setContext] = useState({
    tenant: 'Buscando Tenant...',
    company: 'Buscando Empresa...',
    branch: 'Buscando Filial...',
    user: 'Buscando Usuário...',
    profile: 'Negócio'
  });

  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Aguardando sincronização de contexto com o ERP...' }
  ]);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  
  // v1.3 Lifecycle states
  const [contextReady, setContextReady] = useState(false);
  const [contextMessage, setContextMessage] = useState('Montando ambiente...');

  const conversationEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Escuta contexto da extensão (Real)
  useEffect(() => {
    // Escuta real do Content Script
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'cprot-context-update') {
        setContext(prev => ({ ...prev, ...event.data.payload }));
        setContextReady(true);
        setContextMessage('Sessão validada');
        setMessages([{ role: 'assistant', text: 'Pronto! Contexto sincronizado com sucesso. Como posso ajudar?' }]);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [contextReady]);

  // Mock histórico
  useEffect(() => {
    setHistory([
      { title: 'Faturamento de Julho', date: 'Hoje' },
      { title: 'Análise de Inadimplência', date: 'Ontem' },
      { title: 'Ranking de Vendedores', date: '21 Jul' },
    ]);
  }, []);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Scroll to bottom na conversa
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    if (!contextReady || !text?.trim() || loading) return;
    
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    setResult(null);

    try {
      const payload = { 
        tenant_id: context.tenant_id || '00000000-0000-0000-0000-000000000000', 
        company_id: context.company_id || '00', 
        branch: context.branch, 
        user_id: context.user, 
        request_id: `REQ-${Date.now()}`, 
        prompt: text,
        session_id: context.session_id || 'sess-123'
      };
      
      const res = await api.askAgent(payload);
      
      const formattedResult = {
        ...res,
        rows: res.table || res.rows || [],
        title: text,
      };
      
      setResult(formattedResult);
      
      if (formattedResult.status === 'blocked' || formattedResult.status === 'error' || formattedResult.error) {
        setMessages(m => [...m, { role: 'assistant', text: formattedResult.error || formattedResult.summary || 'Ação bloqueada ou com erro.' }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: formattedResult.summary || 'Análise concluída com sucesso. Verifique o painel lateral para dados completos.' }]);
      }
      
    } catch (e) {
      setResult({ status: 'error', error: e.message, title: 'Erro' });
      setMessages(m => [...m, { role: 'assistant', text: `Ocorreu um erro de comunicação: ${e.message}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
      setInput('');
    }
  };

  const newChat = () => {
    if (!contextReady) return;
    setMessages([{ role: 'assistant', text: 'Nova conversa iniciada. Como posso ajudar?' }]);
    setResult(null);
    setInput('');
    setActiveConversation(null);
  };

  const pickSuggestion = (item) => send(item.title);

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden relative">
      
      <LoadingOverlay visible={!contextReady} text="Sincronizando com ERP..." />

      {/* Coluna 1: SideRail (Left Sidebar) */}
      <SideRail 
        history={history} 
        onSelect={setActiveConversation} 
        onNew={newChat} 
      />

      {/* Coluna 2: Main Panel (Center) */}
      <main className="flex-1 flex flex-col relative z-10 shadow-2xl min-w-[300px]">
        
        {/* Top Context com ContextStatus injetado */}
        <div className="flex flex-col">
           <TopContextStrip context={context} />
           <div className="absolute top-[14px] left-1/2 -translate-x-1/2 z-20">
              <ContextStatus status={contextReady ? 'ok' : 'loading'} message={contextMessage} />
           </div>
        </div>
        
        {messages.length === 1 && !loading && !result ? (
          <div className="flex-1 flex flex-col justify-center pb-20 custom-scrollbar overflow-y-auto">
             <div className="text-center px-6">
                <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                  <span className="text-3xl font-bold bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent">P</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Workspace Analítico</h1>
                <p className="text-slate-500 max-w-md mx-auto">Explore seus dados de forma conversacional.</p>
             </div>
             <QuickSuggestions items={suggestions} onPick={pickSuggestion} disabled={!contextReady || loading} />
          </div>
        ) : (
          <ConversationList messages={messages} loading={loading} ref={conversationEndRef} />
        )}

        {/* Composer Row */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto relative flex items-end">
             <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={contextReady ? 'Pergunte ao Protheus...' : 'Aguardando sincronização de contexto...'}
                disabled={!contextReady || loading}
                rows={1}
                className={`w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-2xl pl-5 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white focus:border-brand-500 transition-all resize-none shadow-inner custom-scrollbar ${!contextReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                onClick={() => { send(input); setInput(''); }}
                disabled={!contextReady || !input.trim() || loading}
                className={`absolute right-2 bottom-2 p-2 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() && !loading && contextReady
                    ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md transform hover:-translate-y-0.5' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
              </button>
          </div>
        </div>
      </main>

      {/* Coluna 3: Results Panel (Right Sidebar) */}
      <aside className="w-[45%] max-w-[600px] min-w-[400px] hidden md:flex flex-col bg-white border-l border-slate-200 z-0 relative">
        {/* Adiciona um overlay sutil na direita enquanto nao tiver contexto */}
        {!contextReady && <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-sm z-10" />}
        <ResultsArea result={result} />
      </aside>

    </div>
  );
}

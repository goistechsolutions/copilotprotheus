import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import ProtheusContextBar from '../components/ProtheusContextBar';
import AgentSidebar from '../components/AgentSidebar';
import ChatPanel from '../components/ChatPanel';
import MessageBubble from '../components/MessageBubble';
import ResultCards from '../components/ResultCards';
import ResultsTable from '../components/ResultsTable';

const defaultSuggestions = [
  { title: 'Faturamento do mês', subtitle: 'Resumo por filial e período' },
  { title: 'Títulos em aberto', subtitle: 'Financeiro e vencimentos' },
  { title: 'Top clientes', subtitle: 'Análise de concentração' },
  { title: 'Produtos mais vendidos', subtitle: 'Ranking por quantidade' },
];

export default function AgentWorkspace() {
  const [context, setContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      tenant: params.get('tenant') || 'Tenant Default',
      company: params.get('company') || 'Matriz',
      branch: params.get('branch') || '0101',
      user: params.get('user') || 'admin'
    };
  });

  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou o seu Copilot integrado ao Protheus. Como posso ajudar com seus dados hoje?' }
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const conversationEndRef = useRef(null);

  // Escuta mensagens do Content Script da extensão do Protheus
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'cprot-context-update') {
        setContext(prev => ({ ...prev, ...event.data.payload }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto scroll no chat
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    if (!text?.trim() || loading) return;
    
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    setResult(null); // Limpa o resultado anterior da direita enquanto carrega

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
      
      // Padroniza a resposta para o frontend
      // A tabela de dados pode vir no array "table" (v1) ou "rows" (v1.1)
      const formattedResult = {
        ...res,
        rows: res.table || res.rows || [],
      };
      
      setResult(formattedResult);
      
      if (formattedResult.status === 'blocked' || formattedResult.status === 'error' || formattedResult.error) {
        setMessages(m => [...m, { role: 'assistant', text: formattedResult.error || formattedResult.summary || 'Ação bloqueada ou com erro.' }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: formattedResult.summary || 'Análise concluída. Veja os detalhes no painel ao lado.' }]);
      }
      
    } catch (e) {
      setResult({ status: 'error', error: e.message });
      setMessages(m => [...m, { role: 'assistant', text: `Ocorreu um erro de comunicação: ${e.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-100 font-sans overflow-hidden">
      
      {/* Coluna Esquerda: Chat & Contexto (Aprox 35%) */}
      <div className="flex flex-col w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-white border-r border-slate-200 shadow-[5px_0_15px_-5px_rgba(0,0,0,0.05)] z-20 h-1/2 lg:h-full relative">
        <ProtheusContextBar context={context} />
        
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar bg-slate-50/50">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} text={m.text} />
          ))}
          {loading && (
             <div className="flex w-full mb-6 justify-start">
              <div className="flex max-w-[85%] gap-3 flex-row">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mt-1 bg-brand-600 text-white">
                  <div className="flex items-center justify-center gap-1">
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                </div>
                <div className="px-4 py-3 text-[13px] bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-sm italic shadow-sm">
                  Consultando o ERP...
                </div>
              </div>
            </div>
          )}
          <div ref={conversationEndRef} />
        </div>
        
        <ChatPanel onSend={send} loading={loading} />
      </div>

      {/* Coluna Direita: Resultados Analíticos (Aprox 65%) */}
      <div className="flex-1 flex flex-col bg-slate-100 h-1/2 lg:h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          
          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                <span className="text-3xl font-bold bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent">P</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Workspace Analítico</h2>
              <p className="text-slate-500 mb-10 text-center max-w-md">
                Aqui aparecerão os resultados gráficos e tabulares das suas requisições. Para começar, selecione uma sugestão ou digite algo ao lado.
              </p>
              <AgentSidebar items={defaultSuggestions} onSelect={send} />
            </div>
          )}

          {loading && !result && (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
               <div className="w-full max-w-3xl space-y-4">
                  <div className="h-24 bg-slate-200 rounded-xl animate-pulse"></div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="h-20 bg-slate-200 rounded-xl animate-pulse"></div>
                    <div className="h-20 bg-slate-200 rounded-xl animate-pulse delay-75"></div>
                    <div className="h-20 bg-slate-200 rounded-xl animate-pulse delay-150"></div>
                    <div className="h-20 bg-slate-200 rounded-xl animate-pulse delay-200"></div>
                  </div>
                  <div className="h-[400px] bg-slate-200 rounded-xl animate-pulse delay-300"></div>
               </div>
            </div>
          )}

          {result && (
            <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 flex flex-col h-full">
              <ResultCards result={result} />
              <div className="flex-1 min-h-[400px]">
                <ResultsTable rows={result.rows || []} />
              </div>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import AgentHeader from '../components/AgentHeader';
import SuggestionGrid from '../components/SuggestionGrid';
import ChatComposer from '../components/ChatComposer';
import ResponsePanel from '../components/ResponsePanel';
import { api } from '../services/api';
import { Sparkles } from 'lucide-react';

const defaultSuggestions = [
  { title: 'Faturamento do mês', subtitle: 'Resumo por filial e período' },
  { title: 'Títulos em aberto', subtitle: 'Financeiro e vencimentos' },
  { title: 'Top clientes', subtitle: 'Análise de concentração' },
  { title: 'Produtos mais vendidos', subtitle: 'Ranking por quantidade' },
];

export default function AgentWorkspace() {
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Contexto inicial via URL ou default
  const [context, setContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      tenant: params.get('tenant') || 'Tenant Default',
      company: params.get('company') || 'Matriz',
      branch: params.get('branch') || '0101',
      user: params.get('user') || 'admin'
    };
  });

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

  const send = async (message) => {
    if (!message?.trim() || isLoading) return;
    
    setIsLoading(true);
    // Limpa resposta anterior ao enviar nova (estilo workspace: focando na atual)
    setResponse(null);

    const payload = {
      request_id: `REQ-${Date.now()}`,
      prompt: message,
      tenant_id: context.tenant_id || '00000000-0000-0000-0000-000000000000',
      company_id: context.company_id || '00',
      branch: context.branch,
      session_id: context.session_id || 'sess-123'
    };

    try {
      const res = await api.askAgent(payload);
      setResponse(res);
    } catch (e) {
      setResponse({ status: 'error', summary: 'Falha na comunicação com o assistente.', error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header Fixo */}
      <AgentHeader context={context} status={isLoading ? 'Analisando...' : 'Conectado ao Protheus'} />

      {/* Área de Conteúdo Rolável */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        {!response && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-full py-12 px-4 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-brand-100">
              <Sparkles size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Como posso ajudar?</h2>
            <p className="text-slate-500 mb-8 max-w-md text-center">Estou conectado ao seu ERP. Selecione uma sugestão ou digite sua pergunta para extrair insights dos dados.</p>
            <SuggestionGrid items={defaultSuggestions} onSelect={send} />
          </div>
        ) : (
          <div className="py-6 px-4 min-h-full">
            <ResponsePanel response={response} />
            {isLoading && (
              <div className="flex items-center justify-center gap-3 text-brand-600 font-medium py-12 animate-pulse">
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input de Mensagem Fixo no Rodapé */}
      <ChatComposer onSend={send} isLoading={isLoading} />
    </div>
  );
}

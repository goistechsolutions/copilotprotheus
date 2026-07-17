import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Menu, Plus, Settings2, User as UserIcon, Building2, Send, History } from 'lucide-react';

import ChatHistory from './components/ChatHistory';
import QuickPrompts from './components/QuickPrompts';
import ChatMessage from './components/ChatMessage';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

export default function App() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Contexto simulado ou recebido da extensão
  const [context, setContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      module: params.get('module') || 'PROTHEUS',
      branch: params.get('branch') || '0101',
      user: params.get('user') || 'admin',
      profile: 'Negócio'
    };
  });

  const [historyItems, setHistoryItems] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load history
    const saved = localStorage.getItem('cprot_history');
    if (saved) {
      try {
        setHistoryItems(JSON.parse(saved));
      } catch (e) {}
    }

    const handleMessage = (event) => {
      // Recebendo dados do contexto (injetados pelo content.js)
      if (event.data && event.data.type === 'cprot-context-update') {
        setContext(prev => ({ ...prev, ...event.data.payload }));
      }

      if (event.data && event.data.type === 'cprot-dashboard-data') {
        const payloadGemini = event.data.payloadGemini;
        setMessages(prev => {
          const newMsgs = [...prev];
          // Atualiza a ultima mensagem de "loading" ou adiciona nova
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].isLoading) {
            newMsgs[newMsgs.length - 1] = { ...payloadGemini, isUser: false };
          } else {
            newMsgs.push({ ...payloadGemini, isUser: false });
          }
          return newMsgs;
        });
        
        setIsLoading(false);
        saveToHistory(payloadGemini);
      }
      
      if (event.data && event.data.type === 'cprot-dashboard-error') {
        setError(event.data.error);
        setIsLoading(false);
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].isLoading) {
            newMsgs[newMsgs.length - 1] = { 
              executive_summary: `**Erro:** ${event.data.error}`, 
              isUser: false,
              kpis: [{label: 'Status', value: 'Erro', color: 'red'}]
            };
          }
          return newMsgs;
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const saveToHistory = (payload) => {
    const newItem = {
      title: payload.titulo || payload.executive_summary?.substring(0, 30) + '...' || 'Análise',
      date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      module: context.module
    };
    
    setHistoryItems(prev => {
      const updated = [newItem, ...prev].slice(0, 20); // Mantem os ultimos 20
      localStorage.setItem('cprot_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAsk = (textToAsk) => {
    const finalQuery = textToAsk || query;
    if (!finalQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setQuery('');

    // Adiciona msg do user
    setMessages(prev => [...prev, { text: finalQuery, isUser: true }]);
    // Adiciona msg de loading do bot
    setMessages(prev => [...prev, { isLoading: true, isUser: false }]);

    // Manda a pergunta para a extensão fazer o Fetch
    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: finalQuery
    }, '*');
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const toggleProfile = () => {
    const nextProfile = context.profile === 'Negócio' ? 'Técnico' : 'Negócio';
    setContext(prev => ({ ...prev, profile: nextProfile }));
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar Histórico */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Histórico
          </h2>
          <button onClick={clearChat} className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-md transition-colors" title="Novo Chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ChatHistory history={historyItems} onSelect={() => {}} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        
        {/* Header / Context Bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                <Building2 className="w-3.5 h-3.5" />
                {context.module} - {context.branch}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                <UserIcon className="w-3.5 h-3.5" />
                {context.user}
              </div>
            </div>
          </div>
          <button onClick={toggleProfile} className="flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
            Perfil: {context.profile}
          </button>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Como posso ajudar?</h2>
              <p className="text-slate-500 mb-8">Estou conectado ao seu ERP. Posso gerar análises, relatórios ou responder dúvidas sobre o Protheus.</p>
              
              <QuickPrompts onSelect={(p) => handleAsk(p)} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full">
              {messages.map((msg, idx) => {
                if (msg.isLoading) {
                  return (
                    <div key={idx} className="flex justify-start mb-6">
                      <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-slate-500">Analisando dados do ERP...</span>
                      </div>
                    </div>
                  );
                }
                return <ChatMessage key={idx} message={msg} isUser={msg.isUser} profile={context.profile} />;
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex relative items-end shadow-sm">
              <textarea
                className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[52px] max-h-32 text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                placeholder="Ex: Qual foi o faturamento por filial este mês?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                disabled={isLoading}
                rows={1}
              />
              <button
                type="submit"
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
                disabled={isLoading || !query.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-slate-400">Pressione Enter para enviar. Shift + Enter para quebrar linha. A IA pode cometer erros, verifique as informações.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

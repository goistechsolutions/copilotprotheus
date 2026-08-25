import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import {
  Sparkles, X, Send, History, Plus, Building2, User as UserIcon,
  CircleCheck, CircleAlert, Paperclip
} from 'lucide-react';

import ChatHistory from './components/ChatHistory';
import QuickPrompts from './components/QuickPrompts';
import ChatMessage from './components/ChatMessage';
import FileUploadButton from './components/FileUploadButton';
import { api } from './services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

// Origens confiáveis para comunicação via postMessage (ajuste conforme seu domínio Protheus real)
const TRUSTED_ORIGINS = [
  'https://protheus.cloudtotvs.com.br',
  'https://webapp.protheus.com.br',
  'https://elitecorp.tec.br',
  window.location.origin,
];

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | error

  const [context, setContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      module: params.get('module') || 'FIN',
      branch: params.get('branch') || '0101',
      user: params.get('user') || 'admin',
      profile: 'Negócio',
    };
  });

  const [historyItems, setHistoryItems] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const historyKey = `cprot_history_${context.user}_${context.branch}`;

  useEffect(() => {
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try {
        setHistoryItems(JSON.parse(saved));
      } catch (e) {
        // histórico corrompido, ignora
      }
    }
  }, [historyKey]);

  useEffect(() => {
    const handleMessage = (event) => {
      // Validação de origem — bloqueia mensagens de fontes não confiáveis
      const isValidOrigin = TRUSTED_ORIGINS.includes(event.origin) || 
                            event.origin.endsWith('.protheus.cloudtotvs.com.br') || 
                            event.origin.endsWith('.elitecorp.tec.br') || 
                            event.origin === 'http://localhost:5173';
                            
      if (!isValidOrigin) return;

      if (event.data?.type === 'cprot-context-update') {
        setContext((prev) => ({ ...prev, ...event.data.payload }));
        setConnectionStatus('connected');
      }

      // Mantido apenas para compatibilidade futura caso a extensão precise enviar dados de volta.
      // O fetch agora é feito nativamente.
      if (event.data?.type === 'cprot-dashboard-data') {
        const payloadGemini = event.data.payloadGemini;
        setMessages((prev) => {
          const newMsgs = [...prev];
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

      if (event.data?.type === 'cprot-dashboard-error') {
        setError(event.data.error);
        setIsLoading(false);
        setMessages((prev) => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].isLoading) {
            newMsgs[newMsgs.length - 1] = {
              executive_summary: `**Erro:** ${event.data.error}`,
              isUser: false,
              kpis: [{ label: 'Status', value: 'Erro', color: 'red' }],
            };
          }
          return newMsgs;
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout de conexão — se não vier contexto em 4s, assume erro (não bloqueia o uso)
    const timer = setTimeout(() => {
      setConnectionStatus((prev) => (prev === 'connecting' ? 'error' : prev));
    }, 4000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
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
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      module: context.module,
    };
    setHistoryItems((prev) => {
      const updated = [newItem, ...prev].slice(0, 20);
      localStorage.setItem(historyKey, JSON.stringify(updated));
      return updated;
    });
  };

  const handleAsk = async (textToAsk) => {
    const finalQuery = textToAsk || query;
    if (!finalQuery.trim() && !attachedFile) return;

    setIsLoading(true);
    setError(null);
    setQuery('');

    // Prepara a visualização do arquivo
    let fileData = null;
    if (attachedFile) {
      fileData = { name: attachedFile.name, type: attachedFile.type };
      
      // Ler o arquivo em base64 se necessário
      const reader = new FileReader();
      const readPromise = new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
      });
      reader.readAsDataURL(attachedFile);
      fileData.data = await readPromise;
      setAttachedFile(null);
    }

    setMessages((prev) => [
      ...prev,
      { text: finalQuery, isUser: true, file: fileData ? fileData.name : null },
    ]);
    setMessages((prev) => [...prev, { isLoading: true, isUser: false }]);

    try {
      const payload = {
        query: finalQuery,
        tenant_id: context.tenant || 'default',
        company_id: context.company,
        branch_id: context.branch,
        user_id: context.user,
        module: context.module
      };
      
      if (fileData) {
        payload.file = fileData;
      }
      
      const res = await api.askAgent(payload);
      
      setMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].isLoading) {
          newMsgs[newMsgs.length - 1] = { ...res, isUser: false };
        } else {
          newMsgs.push({ ...res, isUser: false });
        }
        return newMsgs;
      });
      
      saveToHistory(res);
    } catch (e) {
      setError(e.message);
      setMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].isLoading) {
          newMsgs[newMsgs.length - 1] = { 
            executive_summary: `**Erro:** ${e.message}`, 
            isUser: false,
            kpis: [{label: 'Status', value: 'Erro', color: 'red'}]
          };
        }
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
  };

  const statusConfig = {
    connecting: { label: 'Conectando ao Protheus...', color: 'text-slate-400', icon: <CircleAlert className="w-3.5 h-3.5" /> },
    connected: { label: 'Conectado ao Protheus', color: 'text-green-600', icon: <CircleCheck className="w-3.5 h-3.5" /> },
    error: { label: 'Contexto não detectado', color: 'text-amber-600', icon: <CircleAlert className="w-3.5 h-3.5" /> },
  }[connectionStatus];

  // FAB flutuante quando o drawer está fechado
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center text-white transition-all hover:scale-105 z-50"
        title="Abrir Protheus Copiloto"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[420px] h-full md:h-[640px] bg-white md:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">Protheus Copiloto</h1>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${statusConfig.color}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Histórico"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={clearChat}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Novo chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Context bar compacta */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
        <span className="flex items-center gap-1 text-[11px] font-medium bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-200">
          <Building2 className="w-3 h-3" />
          {context.module} · Filial {context.branch}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-200">
          <UserIcon className="w-3 h-3" />
          {context.user}
        </span>
      </div>

      {/* Drawer de Histórico — sobreposto */}
      <div
        className={`absolute inset-0 bg-white z-20 flex flex-col transition-transform duration-300 ${
          isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-blue-600" />
            Histórico
          </h2>
          <button
            onClick={() => setIsHistoryOpen(false)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ChatHistory history={historyItems} onSelect={() => setIsHistoryOpen(false)} />
        </div>
      </div>

      {/* Área principal do chat */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Olá, como posso ajudar você hoje?</h2>
            <p className="text-sm text-slate-500 mb-5">Estou conectado ao seu ERP e adapto as sugestões ao módulo ativo.</p>
            <QuickPrompts module={context.module} onSelect={(p) => handleAsk(p)} />
          </div>
        ) : (
          <div className="w-full">
            {messages.map((msg, idx) => {
              if (msg.isLoading) {
                return (
                  <div key={idx} className="flex justify-start mb-6">
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600"></div>
                      <span className="text-xs text-slate-500">Analisando dados do ERP...</span>
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

      {/* Input area */}
      <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
        {attachedFile && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mb-2 text-xs text-blue-700">
            <span className="truncate flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              {attachedFile.name}
            </span>
            <button onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-blue-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-end gap-2"
        >
          <FileUploadButton inputRef={fileInputRef} onFileSelect={handleFileSelect} />
          <div className="flex-1 relative">
            <textarea
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 pr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[44px] max-h-28 text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
              placeholder="Pergunte algo sobre o Protheus..."
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
          </div>
          <button
            type="submit"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isLoading || (!query.trim() && !attachedFile)}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-400 mt-1.5">
          A IA pode cometer erros, verifique as informações.
        </p>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, History, Plus, Building2, User as UserIcon, CircleCheck, CircleAlert, Paperclip } from 'lucide-react';
import ChatHistory from './components/ChatHistory';
import QuickPrompts from './components/QuickPrompts';
import ChatMessage from './components/ChatMessage';
import FileUploadButton from './components/FileUploadButton';
import { askAgent, uploadAgentFile } from './services/api';

const TRUSTED_ORIGINS = [window.location.origin];

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [context, setContext] = useState(() => ({
    module: 'FIN',
    branch: '0101',
    user: 'admin',
    profile: 'Negócio',
    tenant_id: 'default',
    company_id: 'default'
  }));
  const [historyItems, setHistoryItems] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!TRUSTED_ORIGINS.includes(event.origin)) return;
      if (event.data?.type === 'cprot-context-update') {
        setContext(prev => ({ ...prev, ...event.data.payload }));
        setConnectionStatus('connected');
      }
      if (event.data?.type === 'cprot-dashboard-data') {
        setMessages(prev => prev.map(m => m.isLoading ? { ...event.data.payloadGemini, isUser: false } : m));
        setIsLoading(false);
      }
      if (event.data?.type === 'cprot-dashboard-error') {
        setError(event.data.error);
        setIsLoading(false);
        setMessages(prev => [...prev.filter(m => !m.isLoading), { executive_summary: `**Erro:** ${event.data.error}`, isUser: false }]);
      }
    };
    window.addEventListener('message', handleMessage);
    const timer = setTimeout(() => setConnectionStatus(prev => prev === 'connecting' ? 'error' : prev), 4000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
  };

  const handleAsk = async (textToAsk) => {
    const finalQuery = textToAsk || query;
    if (!finalQuery.trim() && !attachedFile) return;
    setIsLoading(true);
    setError(null);
    setQuery('');
    setMessages(prev => [
      ...prev,
      { text: finalQuery, isUser: true, file: attachedFile ? attachedFile.name : null },
      { isLoading: true, isUser: false }
    ]);

    try {
      let response;
      if (attachedFile) {
        const formData = new FormData();
        formData.append('file', attachedFile);
        formData.append('tenant_id', context.tenant_id || 'default');
        if (context.company_id) formData.append('company_id', context.company_id);
        formData.append('query', finalQuery);
        formData.append('context', JSON.stringify(context));
        response = await uploadAgentFile(formData);
      } else {
        const payload = { 
          query: finalQuery, 
          tenant_id: context.tenant_id || 'default', 
          company_id: context.company_id || 'default',
          context 
        };
        response = await askAgent(payload);
      }
      
      setMessages(prev => prev.map(m => m.isLoading ? { executive_summary: response.message || response.answer, ...response, isUser: false } : m));
      if (attachedFile) setAttachedFile(null);
      setIsLoading(false);
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
      setMessages(prev => [...prev.filter(m => !m.isLoading), { executive_summary: `**Erro:** ${e.message}`, isUser: false }]);
    }
  };

  const statusConfig = {
    connecting: { label: 'Conectando ao Protheus...', color: 'text-slate-400', icon: <CircleAlert className="w-3.5 h-3.5" /> },
    connected: { label: 'Conectado ao Protheus', color: 'text-green-600', icon: <CircleCheck className="w-3.5 h-3.5" /> },
    error: { label: 'Contexto não detectado', color: 'text-amber-600', icon: <CircleAlert className="w-3.5 h-3.5" /> },
  }[connectionStatus];

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center text-white transition-all hover:scale-105 z-50" title="Abrir Protheus Copiloto">
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[420px] h-full md:h-[640px] bg-white md:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 font-sans">
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">Protheus Copiloto</h1>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${statusConfig.color}`}>{statusConfig.icon}{statusConfig.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsHistoryOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Histórico"><History className="w-4 h-4" /></button>
          <button onClick={() => setMessages([])} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Novo chat"><Plus className="w-4 h-4" /></button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Fechar"><X className="w-4 h-4" /></button>
        </div>
      </header>
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
        <span className="flex items-center gap-1 text-[11px] font-medium bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-200"><Building2 className="w-3 h-3" />{context.module} · Filial {context.branch}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-200"><UserIcon className="w-3 h-3" />{context.user}</span>
      </div>
      <div className={`absolute inset-0 bg-white z-20 flex flex-col transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm"><History className="w-4 h-4 text-blue-600" />Histórico</h2>
          <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ChatHistory history={historyItems} onSelect={() => setIsHistoryOpen(false)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Olá, como posso ajudar você hoje?</h2>
            <p className="text-sm text-slate-500 mb-5">Estou conectado ao seu ERP e adapto as sugestões ao módulo ativo.</p>
            <QuickPrompts module={context.module} onSelect={(p) => handleAsk(p)} />
          </div>
        ) : (
          <div className="w-full">
            {messages.map((msg, idx) => (
              msg.isLoading ? (
                <div key={idx} className="flex justify-start mb-6">
                  <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600"></div>
                    <span className="text-xs text-slate-500">Analisando dados do ERP...</span>
                  </div>
                </div>
              ) : (
                <ChatMessage key={idx} message={msg} isUser={msg.isUser} profile={context.profile} />
              )
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
        {attachedFile && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mb-2 text-xs text-blue-700">
            <span className="truncate flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" />{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-blue-700"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex items-end gap-2">
          <FileUploadButton inputRef={fileInputRef} onFileSelect={handleFileSelect} />
          <div className="flex-1 relative">
            <textarea
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 pr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[44px] max-h-28 text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
              placeholder="Pergunte algo sobre o Protheus..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              disabled={isLoading}
              rows={1}
            />
          </div>
          <button type="submit" className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={isLoading || (!query.trim() && !attachedFile)}>
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-400 mt-1.5">A IA pode cometer erros, verifique as informações.</p>
      </div>
    </div>
  );
}

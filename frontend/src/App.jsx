import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CircleAlert,
  CircleCheck,
  History,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import ChatHistory from './components/ChatHistory';
import QuickPrompts from './components/QuickPrompts';
import ChatMessage from './components/ChatMessage';
import FileUploadButton from './components/FileUploadButton';
import StructuredResultPanel from './components/StructuredResultPanel';
import { askAgent, getAgentTaskStatus, uploadAgentFile } from './services/api';

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [context, setContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      module: params.get('module') || 'SIGAFAT',
      branch: params.get('branch') || '0101',
      user: params.get('user') || 'admin',
      profile: params.get('profile') || 'Negócio',
      tenant_id: params.get('tenant_id') || params.get('tenant') || 'rodol_prod',
      environment_code: params.get('environment_code') || 'c8te0u_prod',
      company_id: params.get('company_id') || params.get('company') || null,
    };
  });
  const [historyItems] = useState([]);
  const [result, setResult] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'cprot-context-update') {
        if (event.source !== window.parent && event.source !== window) return;
        const incoming = event.data.payload || {};

        setContext(prev => ({
          ...prev,
          module: incoming.module || prev.module || 'SIGAFAT',
          branch: incoming.branch || prev.branch || '0101',
          user: incoming.user || prev.user || 'admin',
          profile: incoming.profile || prev.profile || 'Negócio',
          tenant_id: incoming.tenant_id || prev.tenant_id || 'rodol_prod',
          environment_code: incoming.environment_code || prev.environment_code || 'c8te0u_prod',
          company_id: incoming.company_id || prev.company_id,
        }));

        setConnectionStatus('connected');
      }

      if (event.data?.type === 'cprot-dashboard-data') {
        const payload = event.data.payloadGemini || {};
        setMessages(prev => prev.map(message => message.isLoading ? { ...payload, isUser: false } : message));
        setResult({ ...payload, status: payload.status || 'success' });
        setIsResultOpen(true);
        setIsLoading(false);
      }

      if (event.data?.type === 'cprot-dashboard-error') {
        const errorMessage = String(event.data.error || 'Falha no processamento do dashboard.');
        setError(errorMessage);
        setIsLoading(false);
        const errorResult = { status: 'error', error: errorMessage, summary: errorMessage };
        setResult(errorResult);
        setIsResultOpen(true);
        setMessages(prev => [...prev.filter(message => !message.isLoading), { executive_summary: `**Erro:** ${errorMessage}`, isUser: false }]);
      }
    };

    window.addEventListener('message', handleMessage);
    const timer = setTimeout(() => {
      setConnectionStatus(prev => (prev === 'connecting' ? 'connected' : prev));
    }, 2000);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-ready' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) setAttachedFile(file);
    event.target.value = '';
  };

  const validateContext = () => {
    const required = ['tenant_id', 'environment_code'];
    const missing = required.filter(field => !context[field]);
    if (missing.length > 0) {
      throw new Error(`Contexto Protheus incompleto. Campos obrigatórios: ${missing.join(', ')}.`);
    }
  };

  const handleAsk = async (textToAsk) => {
    const finalQuery = textToAsk || query;
    if (!finalQuery.trim() && !attachedFile) return;

    try {
      validateContext();
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
      const errorResult = { status: 'error', error: error.message, summary: error.message };
      setResult(errorResult);
      setIsResultOpen(true);
      setMessages(prev => [
        ...prev.filter(message => !message.isLoading),
        { executive_summary: `**Contexto não disponível:** ${error.message}`, isUser: false },
      ]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuery('');
    setMessages(prev => [
      ...prev,
      { text: finalQuery, isUser: true, file: attachedFile ? attachedFile.name : null },
      { isLoading: true, isUser: false },
    ]);

    try {
      let response;
      if (attachedFile) {
        const formData = new FormData();
        formData.append('file', attachedFile);
        if (context.tenant_id) formData.append('tenant_id', context.tenant_id);
        if (context.environment_code) formData.append('environment_code', context.environment_code);
        if (context.company_id) formData.append('company_id', context.company_id);
        formData.append('query', finalQuery);
        formData.append('context', JSON.stringify(context));
        response = await uploadAgentFile(formData);
      } else {
        const payload = {
          query: finalQuery,
          tenant_id: context.tenant_id,
          environment_code: context.environment_code,
          company_id: context.company_id,
          execute: true,
          context,
        };
        response = await askAgent(payload);
      }

      if (response.status === 'processing' && response.task_id) {
        let isComplete = false;
        while (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          try {
            const statusResponse = await getAgentTaskStatus(response.task_id);
            if (['success', 'execution_failed', 'error', 'completed'].includes(statusResponse.status)) {
              response = statusResponse;
              isComplete = true;
            }
          } catch (pollingError) {
            console.warn('Polling falhou ou sofreu interrupção de rede/CORS:', pollingError);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }

      const structuredResult = {
        ...response,
        summary: response.summary || response.message || response.answer || '',
        data: Array.isArray(response.data) ? response.data : [],
      };
      setResult(structuredResult);
      setIsResultOpen(true);
      setMessages(prev => prev.map(message => message.isLoading ? {
        executive_summary: response.message || response.answer || response.summary || response.execution_error,
        ...response,
        isUser: false,
      } : message));
      if (attachedFile) setAttachedFile(null);
      setIsLoading(false);
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
      const errorResult = { status: 'error', error: error.message, summary: error.message };
      setResult(errorResult);
      setIsResultOpen(true);
      setMessages(prev => [...prev.filter(message => !message.isLoading), { executive_summary: `**Erro:** ${error.message}`, isUser: false }]);
    }
  };

  const statusConfig = {
    connecting: { label: 'Conectando ao Protheus...', color: 'text-slate-400', icon: <CircleAlert className="h-3.5 w-3.5" /> },
    connected: { label: 'Conectado ao Protheus', color: 'text-green-600', icon: <CircleCheck className="h-3.5 w-3.5" /> },
    error: { label: 'Contexto não detectado', color: 'text-amber-600', icon: <CircleAlert className="h-3.5 w-3.5" /> },
  }[connectionStatus];

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700" title="Abrir Protheus Copiloto">
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white font-sans shadow-2xl md:bottom-6 md:right-6 md:h-[640px] md:w-[420px] md:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><Sparkles className="h-4 w-4 text-white" /></div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-slate-800">Protheus Copiloto</h1>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${statusConfig.color}`}>{statusConfig.icon}{statusConfig.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {result && <button onClick={() => setIsResultOpen(true)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Abrir resultados"><BarChart3 className="h-4 w-4" /></button>}
          <button onClick={() => setIsHistoryOpen(true)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100" title="Histórico"><History className="h-4 w-4" /></button>
          <button onClick={() => { setMessages([]); setResult(null); setIsResultOpen(false); }} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100" title="Novo chat"><Plus className="h-4 w-4" /></button>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100" title="Fechar"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
          <Building2 className="h-3 w-3 text-blue-600" />
          {context.module ? `${context.module}${context.branch ? ` - Filial ${context.branch}` : ''}` : 'Módulo Protheus'}
        </span>
        <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
          <UserIcon className="h-3 w-3 text-blue-600" />
          {context.user || 'admin'}
        </span>
      </div>

      <div className={`absolute inset-0 z-20 flex flex-col bg-white transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-blue-600" />Histórico</h2>
          <button onClick={() => setIsHistoryOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ChatHistory history={historyItems} onSelect={() => setIsHistoryOpen(false)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="mb-1 text-lg font-bold text-slate-800">Olá, como posso ajudar você hoje?</h2>
            <p className="mb-5 text-sm text-slate-500">Estou conectado ao seu ERP e adapto as sugestões ao módulo ativo.</p>
            <QuickPrompts module={context.module} onSelect={handleAsk} />
          </div>
        ) : (
          <div className="w-full">
            {messages.map((message, index) => (
              message.isLoading ? (
                <div key={index} className="mb-6 flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-blue-600" />
                    <span className="text-xs text-slate-500">Analisando dados do ERP...</span>
                  </div>
                </div>
              ) : (
                <ChatMessage key={index} message={message} isUser={message.isUser} profile={context.profile} />
              )
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white p-3">
        {attachedFile && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><Paperclip className="h-3.5 w-3.5 shrink-0" />{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-blue-700"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <form onSubmit={(event) => { event.preventDefault(); handleAsk(); }} className="flex items-end gap-2">
          <FileUploadButton inputRef={fileInputRef} onFileSelect={handleFileSelect} />
          <div className="relative flex-1">
            <textarea
              className="min-h-[44px] max-h-28 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-2 text-sm text-slate-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Pergunte algo sobre o Protheus..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleAsk(); } }}
              disabled={isLoading}
              rows={1}
            />
          </div>
          <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50" disabled={isLoading || (!query.trim() && !attachedFile)} aria-label="Enviar pergunta">
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">A IA pode cometer erros, verifique as informações.</p>
      </div>

      {isResultOpen && result && <StructuredResultPanel result={result} onClose={() => setIsResultOpen(false)} />}
    </div>
  );
}


import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { askAgent, waitForAgentTask } from '../../services/api';
import { normalizeAgentResult } from '../../utils/normalizeAgentResult';

export function PromptInput() {
  const [input, setInput] = useState('');
  const { addChatMessage, setIsGenerating, setDashboard, isGenerating, session } = useDashboardStore();
  const controllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    const text = input.trim();
    setInput('');
    
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
    
    setIsGenerating(true);
    setDashboard(null); // Clear previous dashboard when starting a new query
    controllerRef.current = new AbortController();
    
    try {
      const payload = {
        tenant_id: session?.tenantId || '',
        company: session?.company || '',
        branch: session?.branch || '',
        user: session?.userId || session?.user || '',
        environment: session?.environment || '',
        environment_code: session?.environment || '', // Backend validation expects environment_code
        module: session?.module || '',
        session_id: Date.now().toString(), // Podemo usar ID de conversação persistente se houver no futuro
        prompt: text,
        execute: true,
      };

      const accepted = await askAgent(payload, { signal: controllerRef.current.signal });
      const response = accepted.task_id 
        ? await waitForAgentTask(accepted.task_id, { signal: controllerRef.current.signal }) 
        : accepted;
        
      const normalized = normalizeAgentResult(response);

      if (normalized.status === 'error') {
        addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: normalized.message || 'Ocorreu um erro ao processar sua requisição.',
          timestamp: new Date().toISOString()
        });
      } else {
        const result = normalized.result;
        
        // Se a resposta contiver um markdown explicativo, enviamos pro chat
        if (normalized.message) {
          addChatMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: normalized.message,
            timestamp: new Date().toISOString()
          });
        } else {
          addChatMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Dashboard gerado com sucesso.',
            timestamp: new Date().toISOString()
          });
        }
        
        // Se houver grid/charts renderizamos no dashboard (agora vamos mapear o JSON real do Protheus)
        // O Protheus retorna um SQL_QUERY ou DATA. Vamos montar o payload do DashboardEngine:
        if (result && (result.columns || result.sql_query)) {
           setDashboard({
             screenType: 'financial-dashboard', // Default genérico por enquanto
             data: result,
           });
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      addChatMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: error.message || 'Erro de comunicação com o servidor.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsGenerating(false);
      controllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800/60 bg-white dark:bg-slate-900">
      <div className="relative flex items-end rounded-xl border border-slate-300 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-blue-500">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          className="max-h-32 min-h-[44px] w-full resize-none bg-transparent py-3 pl-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 disabled:opacity-50"
          placeholder={isGenerating ? "Processando..." : "Pergunte ao Protheus..."}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className={input.trim() ? "ml-0.5" : ""} />}
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        O Copiloto pode cometer erros. Considere verificar as informações.
      </p>
    </div>
  );
}

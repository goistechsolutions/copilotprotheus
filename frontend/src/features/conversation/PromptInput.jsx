import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { askAgent, waitForAgentTask } from '../../services/api';
import { normalizeAgentResult } from '../../utils/normalizeAgentResult';
import { buildAdaptiveDashboard } from '../../services/adaptiveDashboardEngine';

export function PromptInput() {
  const [input, setInput] = useState('');
  const { 
    addChatMessage, 
    setIsGenerating, 
    setDashboard, 
    addToHistory, 
    isGenerating, 
    session,
    setProcessingStep,
    pendingPrompt,
    clearPendingPrompt,
  } = useDashboardStore();
  const controllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  // Monitora solicitações programáticas de prompt (drill-down e cliques em sugestões)
  useEffect(() => {
    if (pendingPrompt && !isGenerating) {
      const text = pendingPrompt;
      clearPendingPrompt();
      executePrompt(text);
    }
  }, [pendingPrompt, isGenerating]);

  const executePrompt = async (promptText) => {
    if (!promptText || isGenerating) return;
    
    const text = promptText.trim();
    setInput('');
    
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
    
    setIsGenerating(true);
    setProcessingStep(1); // 1. Entendendo pergunta
    controllerRef.current = new AbortController();
    
    try {
      const currentMod = session?.module || session?.currentModule || 'SIGAFAT';
      const payload = {
        tenant_id: session?.tenantId || '',
        company: session?.company || '',
        branch: session?.branch || '',
        user: session?.userId || session?.user || '',
        environment: session?.environment || '',
        environment_code: session?.environment || '',
        module: currentMod,
        module_sigla: currentMod,
        session_id: Date.now().toString(),
        prompt: text,
        execute: true,
      };

      setProcessingStep(2); // 2. Gerando consulta
      const accepted = await askAgent(payload, { signal: controllerRef.current.signal });
      
      setProcessingStep(3); // 3. Consultando Protheus
      const response = accepted.task_id 
        ? await waitForAgentTask(accepted.task_id, { signal: controllerRef.current.signal }) 
        : accepted;
        
      setProcessingStep(4); // 4. Analisando dados
      const normalized = normalizeAgentResult(response);

      if (normalized.status === 'error') {
          addChatMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: normalized.message || 'Ocorreu um erro ao processar sua requisição.',
            errorCode: normalized.errorCode,
            domainDiagnostic: normalized.domainDiagnostic || null,
            timestamp: new Date().toISOString()
          });
      } else {
        const result = normalized.result;
        
        setProcessingStep(5); // 5. Gerando insights
        let adaptive = null;
        if (result && Array.isArray(result.rows) && result.rows.length > 0) {
          adaptive = buildAdaptiveDashboard(result.rows, result.columns || []);
          if (adaptive) {
            adaptive.originPrompt = text;
            setProcessingStep(6); // 6. Montando dashboard
          }
        } else if (result && (result.columns || result.sql_query)) {
          adaptive = {
            screenType: 'custom',
            data: result,
            originPrompt: text,
          };
        }

        // Utiliza o sumário executivo gerado pelo motor analítico (AnalysisContext)
        const finalMessage = adaptive?.executiveSummary || normalized.message || 'Análise concluída com sucesso.';

        addChatMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: finalMessage,
          dashboard: adaptive,
          suggestions: adaptive?.suggestions || [],
          originPrompt: text,
          timestamp: new Date().toISOString()
        });

        // Registrar no histórico unificado de dashboards
        if (adaptive) {
          addToHistory({
            prompt: text,
            title: text,
            dashboard: adaptive,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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
      setProcessingStep(1);
      controllerRef.current = null;
    }
  };

  const handleSend = () => {
    if (input.trim()) {
      executePrompt(input);
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

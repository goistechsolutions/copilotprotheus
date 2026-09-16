import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { askAgent, waitForAgentTask } from '../../services/api';
import { normalizeAgentResult } from '../../utils/normalizeAgentResult';
import { buildAdaptiveDashboard } from '../../services/adaptiveDashboardEngine';

export function PromptInput() {
  const [input, setInput] = useState('');
  const { 
    chat,
    addChatMessage, 
    setIsGenerating, 
    setDashboard, 
    addToHistory, 
    isGenerating, 
    session,
    setSession,
    setProcessingStep,
    pendingPrompt,
    clearPendingPrompt,
    currentDashboard,
    currentConversationId,
    newConversation,
    syncMessage,
    syncDashboard,
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
    if (!text) return;
    setInput('');

    // Garante que exista um conversation_id ativo
    let convId = currentConversationId;
    if (!convId) {
      convId = await newConversation(text);
    }
    
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });

    // Sincroniza pergunta do usuário no backend
    syncMessage(convId, 'user', text, { originPrompt: text });
    
    setIsGenerating(true);
    setProcessingStep(1); // 1. Entendendo pergunta
    controllerRef.current = new AbortController();
    
    try {
      let currentMod = session?.module || session?.currentModule;
      const lower = (text || '').toLowerCase();
      if (/fluxo de caixa|contas a pagar|contas a receber|inadimpl|vencimento|boleto|t[ií]tulo|se1|se2|se5|saldo banc|movimento banc/i.test(lower)) {
        currentMod = 'SIGAFIN';
      } else if (/compra|fornecedor|pedido de compra|sc7|recebimento/i.test(lower)) {
        currentMod = 'SIGACOM';
      } else if (/estoque|saldo de estoque|sb1|sb2|armaz[eé]m/i.test(lower)) {
        currentMod = 'SIGAEST';
      } else if (/venda|fatur|pedido de venda|cliente|sf2|sd2|sc5/i.test(lower)) {
        currentMod = 'SIGAFAT';
      } else if (!currentMod) {
        currentMod = 'SIGAFAT';
      }

      if (setSession && currentMod !== session?.module) {
        setSession({ module: currentMod, currentModule: currentMod });
      }

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
          const promptDomain = /fluxo de caixa|contas a pagar|contas a receber|inadimpl|vencimento|boleto|t[ií]tulo|se1|se2|se5|saldo banc|movimento banc/i.test(text)
            ? 'finance'
            : /compra|fornecedor|pedido de compra|recebimento/i.test(text)
              ? 'purchases'
              : /venda|fatur|pedido de venda|sf2|sd2|sc5/i.test(text)
                ? 'sales'
                : null;
          const semanticContext = {
            ...(result.metadata || {}),
            originPrompt: text,
            prompt: text,
            intent: result.intent || result.metadata?.intent || null,
            domain: result.domain || result.metadata?.domain || promptDomain,
            measureFormat: result.metadata?.measureFormat || result.kpis?.[0]?.format || null,
            columnLabels: result.column_labels || result.metadata?.column_labels || null,
          };
          adaptive = buildAdaptiveDashboard(
            result.rows,
            result.columns || [],
            semanticContext,
            result.backend_kpis || null,
            result.backend_insights || null
          );
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

        // Sincroniza resposta do assistente no backend
        syncMessage(convId, 'assistant', finalMessage, {
          originPrompt: text,
          dashboard: adaptive,
          suggestions: adaptive?.suggestions || [],
        });

        // Registrar no histórico unificado de dashboards
        if (adaptive) {
          addToHistory({
            prompt: text,
            title: text,
            dashboard: adaptive,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          });

          // Sincroniza dashboard na conversa no backend
          syncDashboard(
            convId,
            adaptive.originPrompt || text,
            adaptive,
            adaptive.insights || null,
            result?.sql_query || ''
          );

          // Se o usuário já estiver com um dashboard aberto em tela cheia, atualiza-o imediatamente
          if (currentDashboard) {
            setDashboard(adaptive);
          }
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

  const placeholderText = isGenerating
    ? "Processando no Oracle Protheus..."
    : (chat.messages.length === 0 ? "Pergunte ao ERP..." : "Continue a análise...");

  return (
    <div className="shrink-0 px-4 sm:px-6 py-4 bg-transparent max-w-2xl w-full mx-auto">
      <div className="relative flex items-center rounded-[20px] border border-slate-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-[#0B0E14] backdrop-blur-sm px-4 py-1.5 focus-within:border-[#4F7CFF] focus-within:ring-1 focus-within:ring-[#4F7CFF]/30 transition-all min-h-[50px]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          className="flex-1 max-h-32 min-h-[26px] resize-none bg-transparent py-2 pr-2 text-sm sm:text-[15px] text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-50 leading-relaxed font-normal"
          placeholder={placeholderText}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F7CFF] hover:bg-[#3D6BF0] text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 ml-2"
          title="Enviar (➜)"
        >
          {isGenerating ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ArrowRight size={15} />
          )}
        </button>
      </div>
    </div>
  );
}


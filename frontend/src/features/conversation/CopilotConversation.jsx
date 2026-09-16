import React, { useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  LayoutDashboard, 
  AlertTriangle, 
  Database 
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { ProcessingTracker } from '../../components/chat/ProcessingTracker';

const TABLE_LABELS = {
  SE1: 'Contas a Receber',
  SE2: 'Contas a Pagar',
  SE5: 'Movimentação Financeira',
  SF2: 'Notas Fiscais de Saída',
  SD2: 'Itens de Saída',
  SA1: 'Clientes',
  SF1: 'Notas Fiscais de Entrada',
  SD1: 'Itens de Entrada',
  SA2: 'Fornecedores',
};

function DomainMismatchCard({ diag }) {
  if (!diag) return null;
  const missingTables = diag.missing_tables || [];
  return (
    <div className="py-2 text-sm text-amber-700 dark:text-amber-400 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-amber-500 shrink-0" />
        <span className="font-medium">Dados indisponíveis no snapshot</span>
      </div>

      {missingTables.length > 0 && (
        <ul className="pl-6 space-y-1 text-xs">
          {missingTables.map(({ code, description }) => (
            <li key={code} className="list-disc">
              <span className="font-mono font-semibold">{code}</span>
              {' '}— {description || TABLE_LABELS[code] || ''}
            </li>
          ))}
        </ul>
      )}

      {diag.suggested_action && (
        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
          Ação: {diag.suggested_action}
        </p>
      )}
    </div>
  );
}

/**
 * CopilotConversation — Minimalist Pure Typography
 * Sem caixas, sem bordas, sem avatares, sem cards.
 * Foco 100% na leitura e inteligência analítica.
 */
export function CopilotConversation() {
  const { 
    chat, 
    setDashboard, 
    isGenerating, 
    processingStep, 
    triggerPrompt 
  } = useDashboardStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages, isGenerating, processingStep]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8" ref={scrollRef}>
      <div className="max-w-2xl mx-auto flex flex-col space-y-8">
        {chat.messages.map((msg, index) => {
          const isUser = msg.role === 'user';

          return (
            <div key={msg.id || index} className="space-y-4">
              {isUser ? (
                /* Turno do Usuário: Puro Texto */
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Você
                  </p>
                  <p className="text-sm sm:text-base text-slate-900 dark:text-slate-100 font-normal leading-relaxed whitespace-pre-line">
                    {msg.content}
                  </p>
                </div>
              ) : (
                /* Turno do Assistente: Análise Concluída + Texto + Botão + Sugestões */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#4F7CFF]">
                      Análise concluída
                    </p>
                    {msg.domainDiagnostic ? (
                      <DomainMismatchCard diag={msg.domainDiagnostic} />
                    ) : (
                      <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200 font-normal leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </div>
                    )}
                  </div>

                  {/* Ação Primária: [ Abrir Dashboard ] em #4F7CFF */}
                  {msg.dashboard && (
                    <div className="pt-2">
                      <button
                        onClick={() => setDashboard(msg.dashboard)}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium bg-[#4F7CFF] hover:bg-[#3D6BF0] text-white transition-all shadow-xs active:scale-98 cursor-pointer"
                      >
                        <LayoutDashboard size={14} />
                        <span>Abrir Dashboard</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Sugestões Contextuais: Aparecem somente após resposta, em texto simples */}
                  {msg.suggestions?.length > 0 && (
                    <div className="border-t border-slate-200/50 dark:border-white/5 pt-4 mt-6 space-y-2">
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        Continuar análise
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => triggerPrompt(sug)}
                            className="text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-[#4F7CFF] dark:hover:text-[#4F7CFF] transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>•</span>
                            <span>{sug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Linha Divisória Minimalista entre Interações */}
              <div className="border-b border-slate-200/40 dark:border-white/5 pt-4" />
            </div>
          );
        })}

        {/* Indicador de Processamento Minimalista */}
        {isGenerating && (
          <div className="space-y-2 pt-2 animate-in fade-in duration-200">
            <p className="text-xs font-medium text-[#4F7CFF] flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4F7CFF] animate-pulse" />
              Processando análise no Oracle Protheus...
            </p>
            <div className="max-w-md">
              <ProcessingTracker currentStep={processingStep} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

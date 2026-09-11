import React, { useEffect, useRef } from 'react';
import { Bot, User, AlertTriangle, Database, ArrowRight, LayoutDashboard } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800/40 dark:bg-amber-900/10 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          Dados indisponíveis no snapshot
        </span>
      </div>

      {missingTables.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2 font-medium">
            Tabelas necessárias não sincronizadas:
          </p>
          <ul className="space-y-1">
            {missingTables.map(({ code, description }) => (
              <li key={code} className="flex items-center gap-2">
                <Database size={12} className="text-amber-500 shrink-0" />
                <span className="font-mono text-xs text-amber-800 dark:text-amber-300 font-semibold">{code}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  — {description || TABLE_LABELS[code] || ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diag.suggested_action && (
        <div className="flex items-start gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/30">
          <ArrowRight size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-medium">Ação recomendada: </span>
            {diag.suggested_action}
          </p>
        </div>
      )}
    </div>
  );
}


export function CopilotConversation() {
  const { chat, currentDashboard, setDashboard } = useDashboardStore();
  const scrollRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages]);

  return (
    <div className="flex-1 overflow-y-auto p-5" ref={scrollRef}>
      {/* Mensagem Inicial */}
      {chat.messages.length === 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
          <p>Olá! Eu sou o Copiloto Executivo. O que você gostaria de analisar hoje?</p>
        </div>
      )}

      {/* Lista de Mensagens */}
      <div className="flex flex-col gap-6 mt-4">
        {chat.messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              msg.role === 'user' 
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' 
                : 'bg-blue-600 text-white'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            {/* Balloon de Mensagem */}
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Card especial para DOMAIN_CATALOG_MISMATCH */}
              {msg.domainDiagnostic ? (
                <DomainMismatchCard diag={msg.domainDiagnostic} />
              ) : (
                <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                }`}>
                  {msg.content}
                </div>
              )}

              {/* Botão de Ação para Abrir / Reabrir Dashboard */}
              {msg.dashboard && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setDashboard(msg.dashboard)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border shadow-sm ${
                      currentDashboard === msg.dashboard
                        ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:border-blue-800'
                    }`}
                  >
                    <LayoutDashboard size={13} />
                    <span>{currentDashboard === msg.dashboard ? 'Dashboard em exibição' : 'Abrir Dashboard'}</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              )}

              <span className="mt-1 text-[10px] text-slate-400">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

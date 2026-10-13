import React, { useEffect, useRef } from 'react';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';
import { TrendingUp, Users, DollarSign } from 'lucide-react';

export function MessageList({ 
  messages = [], 
  onOpenDashboard, 
  onSelectPrompt 
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const defaultSuggestions = [
    {
      label: 'Faturamento deste mês',
      icon: TrendingUp,
      prompt: 'Resuma o faturamento acumulado do mês atual comparado por vendedor',
    },
    {
      label: 'Comparar vendas por vendedor',
      icon: Users,
      prompt: 'Compare as vendas realizadas por vendedor no período recente',
    },
    {
      label: 'Analisar contas a receber',
      icon: DollarSign,
      prompt: 'Resuma os títulos a receber e a situação da inadimplência',
    },
  ];

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col justify-center flex-1 px-4 py-8 max-w-sm mx-auto w-full animate-fade-in select-none">
        <div className="mb-6 text-left">
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
            Olá! Como posso ajudar?
          </h2>
          <p className="text-xs text-[var(--color-muted)]">
            Selecione uma análise rápida abaixo ou faça sua pergunta.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)] mb-1">
            Sugestões
          </span>

          {defaultSuggestions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt && onSelectPrompt(item.prompt)}
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-[var(--color-surface)] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-[var(--color-border)] text-left text-xs font-medium text-[var(--color-text)] transition-all cursor-pointer shadow-xs hover:border-blue-500/40 hover:translate-x-0.5"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <Icon size={14} />
                </div>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      {messages.map((msg, index) => {
        if (msg.role === 'user') {
          return <UserMessage key={msg.id || index} message={msg} />;
        }
        return (
          <AssistantMessage
            key={msg.id || index}
            message={msg}
            onOpenDashboard={onOpenDashboard}
            onSelectSuggestion={onSelectPrompt}
          />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;

import React from 'react';
import { Sparkles, TrendingUp, Users, DollarSign } from 'lucide-react';

interface EmptyConversationProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyConversation({ onSelectPrompt }: EmptyConversationProps) {
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

  return (
    <div className="flex flex-col justify-center flex-1 px-4 py-8 max-w-sm mx-auto w-full animate-fade-in select-none">
      <div className="mb-6 text-left">
        <h2 className="text-xl font-bold text-[var(--cprot-text-main)] mb-1">
          Olá! Como posso ajudar?
        </h2>
        <p className="text-xs text-[var(--cprot-text-sub)]">
          Selecione uma análise rápida abaixo ou faça sua pergunta.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--cprot-text-muted)] mb-1">
          Sugestões
        </span>

        {defaultSuggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] text-left text-xs font-medium text-[var(--cprot-text-main)] transition-all cursor-pointer shadow-xs hover:border-[var(--cprot-primary)]/40 hover:translate-x-0.5"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--cprot-primary)]/10 text-[var(--cprot-primary)] shrink-0">
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

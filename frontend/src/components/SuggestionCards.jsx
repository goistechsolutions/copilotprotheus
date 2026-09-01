import React from 'react';
import {
  TrendingUp,
  Building2,
  FileText,
  BarChart3
} from 'lucide-react';

const defaultSuggestions = [
  {
    icon: TrendingUp,
    title: 'Fluxo de Caixa',
    subtitle: 'Consultar fluxo e recebimentos',
    prompt: 'Qual a previsão de fluxo de caixa e recebimentos para os próximos 30 dias?',
  },
  {
    icon: Building2,
    title: 'Comparar Filiais',
    subtitle: 'Faturamento por unidade',
    prompt: 'Compare o faturamento consolidado entre as filiais no mês atual.',
  },
  {
    icon: FileText,
    title: 'Contas a Pagar',
    subtitle: 'Títulos e compromissos',
    prompt: 'Liste os principais títulos a pagar em aberto com fornecedor e vencimento.',
  },
  {
    icon: BarChart3,
    title: 'Análise de Vendas',
    subtitle: 'Resumo executivo do mês',
    prompt: 'Apresente a análise de vendas e faturamento do período com curva ABC.',
  },
];

export default function SuggestionCards({ items, disabled, onPick }) {
  const list = items?.length ? items : defaultSuggestions;

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {list.map((item, index) => {
          const Icon = item.icon || defaultSuggestions[index % 4].icon;
          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item.prompt || item.title)}
              className="executive-card p-3.5 text-left flex flex-col justify-between min-h-[105px] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-[#EEF3F8] text-[#0F66FF] mb-2.5">
                <Icon size={17} strokeWidth={2} />
              </div>
              <div>
                <strong className="block text-[13px] font-bold text-[#1a334e] leading-snug">
                  {item.title}
                </strong>
                <span className="block text-[11px] text-[#7c8e9f] mt-0.5 leading-tight">
                  {item.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

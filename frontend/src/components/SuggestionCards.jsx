import React from 'react';
import {
  FileText,
  TrendingUp,
  Calendar,
  BarChart3
} from 'lucide-react';

const defaultSuggestions = [
  {
    icon: FileText,
    title: 'Consultar contas a pagar',
    subtitle: 'Listar títulos do período atual',
    prompt: 'Liste os títulos a pagar em aberto com fornecedor, valor e data de vencimento.',
  },
  {
    icon: TrendingUp,
    title: 'Prever recebimentos',
    subtitle: 'Análise de recebimentos esperados',
    prompt: 'Qual a previsão de contas a receber para os próximos 30 dias?',
  },
  {
    icon: Calendar,
    title: 'Melhor data de pagamento',
    subtitle: 'Simular datas para economia',
    prompt: 'Quais títulos a pagar vencem nesta semana ordenados por valor?',
  },
  {
    icon: BarChart3,
    title: 'Análise de vendas',
    subtitle: 'Resumo de vendas do mês',
    prompt: 'Qual o resumo consolidado de faturamento e vendas deste mês por filial?',
  },
];

export default function SuggestionCards({ items, disabled, onPick }) {
  const list = items?.length ? items : defaultSuggestions;

  return (
    <div className="w-full">
      <h3 className="text-[15px] font-bold text-[#1a334e] mb-3.5">
        Sugestões de consulta
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {list.map((item, index) => {
          const Icon = item.icon || defaultSuggestions[index % 4].icon;
          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item.prompt || item.title)}
              className="protheus-subcard p-3.5 text-left flex flex-col justify-between min-h-[110px] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5fd] text-[#1860ec] mb-2.5">
                <Icon size={18} strokeWidth={2} />
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

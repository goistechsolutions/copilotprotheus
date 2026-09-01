import React from 'react';
import {
  TrendingUp,
  BarChart3,
  Package,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';

export const stitchSuggestions = [
  {
    id: 'prever_recebimentos',
    icon: TrendingUp,
    iconColor: 'text-[#004FCE] dark:text-[#60A5FA]',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    hoverGradient: 'from-[#004FCE]/5',
    title: 'Prever Recebimentos',
    subtitle: 'Analise o fluxo de caixa projetado para a próxima semana.',
    category: 'SUGESTÃO',
    prompt: 'Qual a previsão consolidada de recebimentos e fluxo de caixa projetado para a próxima semana?',
  },
  {
    id: 'analise_vendas',
    icon: BarChart3,
    iconColor: 'text-[#A13400] dark:text-[#FB923C]',
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
    hoverGradient: 'from-[#A13400]/5',
    title: 'Análise de Vendas',
    subtitle: 'Comparativo de faturamento mensal por filial.',
    category: 'SUGESTÃO',
    prompt: 'Apresente o faturamento consolidado deste mês detalhado por filial e principais produtos.',
  },
  {
    id: 'estoque_critico',
    icon: Package,
    iconColor: 'text-[#F59E0B] dark:text-[#FBBF24]',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    hoverGradient: 'from-[#F59E0B]/5',
    title: 'Estoque Crítico',
    subtitle: 'Identificar itens com saldo abaixo do ponto de pedido.',
    category: 'SUGESTÃO',
    prompt: 'Quais produtos estão com saldo de estoque crítico ou abaixo do ponto de pedido no SIGAEST?',
  },
  {
    id: 'titulos_vencidos',
    icon: Receipt,
    iconColor: 'text-[#495F82] dark:text-[#94A3B8]',
    bgColor: 'bg-slate-100 dark:bg-slate-800/60',
    hoverGradient: 'from-[#495F82]/5',
    title: 'Títulos Vencidos',
    subtitle: 'Resumo do contas a receber em atraso no período.',
    category: 'SUGESTÃO',
    prompt: 'Liste os títulos a receber vencidos no SIGAFIN ordenados pelo maior valor em aberto.',
  },
];

export default function SuggestionCards({ items, disabled, onPick }) {
  const list = items?.length ? items : stitchSuggestions;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {list.map((item, index) => {
        const Icon = item.icon || stitchSuggestions[index % stitchSuggestions.length].icon;
        const iconColor = item.iconColor || 'text-[#004FCE]';
        const bgColor = item.bgColor || 'bg-blue-50';
        const hoverGradient = item.hoverGradient || 'from-[#004FCE]/5';

        return (
          <button
            key={item.id || `${item.title}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.prompt || item.title)}
            className="stitch-card p-5 text-left group flex flex-col justify-between relative overflow-hidden active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {/* Subtle Gradient Hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${hoverGradient} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

            <div>
              {/* Category & Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    {item.category || 'SUGESTÃO'}
                  </span>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-[#004FCE] dark:group-hover:text-[#60A5FA] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </div>

              {/* Title */}
              <h3 className="text-[16px] font-bold text-[#171C20] dark:text-white leading-snug group-hover:text-[#004FCE] dark:group-hover:text-[#60A5FA] transition-colors">
                {item.title}
              </h3>

              {/* Subtitle */}
              <p className="text-[13px] text-[#475569] dark:text-slate-400 mt-1 leading-relaxed">
                {item.subtitle}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

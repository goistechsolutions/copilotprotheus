import React from 'react';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Building2,
  PieChart,
  PackageX,
  AlertTriangle,
  Award,
  ArrowRight,
} from 'lucide-react';

export const executiveSuggestions = [
  {
    id: 'fluxo_caixa',
    icon: DollarSign,
    color: 'from-blue-600 to-indigo-600',
    title: 'Fluxo de Caixa',
    subtitle: 'Previsão de entradas e saídas para os próximos 30 dias',
    category: 'Financeiro',
    prompt: 'Qual a previsão consolidada de fluxo de caixa e compromissos para os próximos 30 dias?',
  },
  {
    id: 'faturamento',
    icon: TrendingUp,
    color: 'from-emerald-600 to-teal-600',
    title: 'Faturamento',
    subtitle: 'Total faturado por filial e clientes no mês',
    category: 'Vendas',
    prompt: 'Apresente o faturamento consolidado deste mês detalhado por filial e principais clientes.',
  },
  {
    id: 'contas_receber',
    icon: FileText,
    color: 'from-cyan-600 to-blue-600',
    title: 'Contas a Receber',
    subtitle: 'Títulos em aberto e projeção de liquidação',
    category: 'Crédito',
    prompt: 'Liste os títulos a receber em aberto com cliente, valor e data de vencimento.',
  },
  {
    id: 'comparar_filiais',
    icon: Building2,
    color: 'from-purple-600 to-indigo-600',
    title: 'Comparar Filiais',
    subtitle: 'Performance e curva comparativa entre unidades',
    category: 'Operacional',
    prompt: 'Compare o desempenho de faturamento e volume de vendas entre todas as filiais.',
  },
  {
    id: 'margem_lucro',
    icon: PieChart,
    color: 'from-amber-500 to-orange-600',
    title: 'Margem de Lucro',
    subtitle: 'Margem de contribuição por linha de produto',
    category: 'Controladoria',
    prompt: 'Analise a margem de contribuição e lucratividade por grupo e linha de produto.',
  },
  {
    id: 'produtos_parados',
    icon: PackageX,
    color: 'from-slate-600 to-slate-800',
    title: 'Produtos Parados',
    subtitle: 'Itens sem movimentação no estoque há mais de 90 dias',
    category: 'Estoque',
    prompt: 'Quais produtos estão sem movimentação de saída no estoque há mais de 90 dias?',
  },
  {
    id: 'inadimplentes',
    icon: AlertTriangle,
    color: 'from-rose-600 to-pink-600',
    title: 'Clientes Inadimplentes',
    subtitle: 'Títulos vencidos e análise de risco financeiro',
    category: 'Risco',
    prompt: 'Quais clientes possuem títulos vencidos em aberto ordenados pelo maior valor?',
  },
  {
    id: 'ranking_vendedores',
    icon: Award,
    color: 'from-violet-600 to-purple-700',
    title: 'Ranking de Vendedores',
    subtitle: 'Top performance comercial e comissionamento',
    category: 'Comercial',
    prompt: 'Apresente o ranking dos vendedores com maior volume faturado no período.',
  },
];

export default function SuggestionCards({ items, disabled, onPick }) {
  const list = items?.length ? items : executiveSuggestions;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
      {list.map((item, index) => {
        const Icon = item.icon || executiveSuggestions[index % executiveSuggestions.length].icon;
        const color = item.color || 'from-blue-600 to-indigo-600';

        return (
          <button
            key={item.id || `${item.title}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.prompt || item.title)}
            className="exec-card p-4 text-left flex flex-col justify-between min-h-[128px] group active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-xs transition-transform group-hover:scale-105`}>
                  <Icon size={18} strokeWidth={2} />
                </span>
                {item.category && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {item.category}
                  </span>
                )}
              </div>
              <strong className="block text-[14px] font-bold text-[#162D52] dark:text-white leading-tight group-hover:text-[#0F66FF] dark:group-hover:text-[#3882FF] transition-colors">
                {item.title}
              </strong>
              <span className="block text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {item.subtitle}
              </span>
            </div>
            <div className="pt-2 flex items-center justify-end">
              <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-[#0F66FF] dark:group-hover:text-[#3882FF] transition-colors group-hover:translate-x-0.5" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

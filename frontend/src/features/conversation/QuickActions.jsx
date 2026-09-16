import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ArrowUpRight 
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function QuickActions() {
  const { triggerPrompt, isGenerating, session } = useDashboardStore();

  const handleAction = (text) => {
    if (isGenerating) return;
    triggerPrompt(text);
  };

  // Saudação personalizada por horário
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Nome do usuário
  const rawUser = session?.userName || session?.user || session?.userId || 'Executivo';
  const firstName = rawUser.split(/[\s._@]/)[0] || 'Executivo';
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // 4 Cards Principais (Minimal Executive)
  const executiveCards = [
    {
      id: 'caixa',
      title: 'Fluxo de Caixa',
      subtitle: 'Próximos 30 dias',
      icon: DollarSign,
      iconColor: 'text-amber-500 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      prompt: 'Projeção de fluxo de caixa e recebimentos dos próximos 30 dias',
    },
    {
      id: 'inadimplencia',
      title: 'Inadimplência',
      subtitle: 'Clientes em risco',
      icon: AlertTriangle,
      iconColor: 'text-rose-500 dark:text-rose-400',
      bgColor: 'bg-rose-500/10',
      prompt: 'Clientes com títulos vencidos acima de 60 dias e risco de inadimplência',
    },
    {
      id: 'vendas',
      title: 'Vendas',
      subtitle: 'Faturamento do mês',
      icon: TrendingUp,
      iconColor: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      prompt: 'Faturamento acumulado do mês atual comparado por vendedor',
    },
    {
      id: 'estoque',
      title: 'Estoque',
      subtitle: 'Produtos sem giro',
      icon: Package,
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      prompt: 'Identificar produtos parados sem movimentação nos últimos 90 dias com saldo em estoque',
    },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-4 max-w-xl mx-auto animate-in fade-in duration-300">
      {/* Saudação Executiva Minimalista */}
      <div className="text-center mb-6 space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {getGreeting()}, {formattedName}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          O que deseja analisar hoje?
        </p>
      </div>

      {/* Grid de 4 Cards (2 Colunas, Focado) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mb-5">
        {executiveCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              disabled={isGenerating}
              onClick={() => handleAction(card.prompt)}
              className="group p-3.5 text-left rounded-2xl glass-card-executive cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl ${card.bgColor} ${card.iconColor} shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {card.subtitle}
                    </p>
                  </div>
                </div>

                <ArrowUpRight 
                  size={14} 
                  className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" 
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Sugestões Rápidas Minimalistas */}
      <div className="w-full flex flex-wrap items-center justify-center gap-1.5 pt-1">
        {[
          "Extrato do maior devedor",
          "Ranking de clientes",
          "Inadimplência > 60 dias",
          "Notas fiscais recentes"
        ].map((text) => (
          <button
            key={text}
            type="button"
            disabled={isGenerating}
            onClick={() => handleAction(text)}
            className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

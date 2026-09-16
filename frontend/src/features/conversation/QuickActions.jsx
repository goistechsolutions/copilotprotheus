import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  FileText, 
  Sparkles, 
  ArrowUpRight 
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function QuickActions() {
  const { triggerPrompt, isGenerating } = useDashboardStore();

  const handleAction = (text) => {
    if (isGenerating) return;
    triggerPrompt(text);
  };

  const domainCards = [
    {
      id: 'financeiro',
      title: 'Financeiro',
      description: 'Fluxo de caixa, títulos a receber e risco de inadimplência',
      icon: DollarSign,
      iconColor: 'text-amber-500 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      badge: 'SE1 / SE2',
      prompt: 'Projeção de fluxo de caixa e recebimentos dos próximos 30 dias',
    },
    {
      id: 'vendas',
      title: 'Vendas',
      description: 'Faturamento acumulado, margem e ranking comercial',
      icon: TrendingUp,
      iconColor: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      badge: 'SF2 / SD2',
      prompt: 'Faturamento acumulado do mês atual comparado por vendedor e filial',
    },
    {
      id: 'estoque',
      title: 'Estoque',
      description: 'Itens parados sem giro e risco de ruptura no almoxarifado',
      icon: Package,
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      badge: 'SB1 / SB2',
      prompt: 'Identificar produtos parados sem movimentação nos últimos 90 dias com saldo em estoque',
    },
    {
      id: 'fiscal',
      title: 'Fiscal & Compras',
      description: 'Notas fiscais de entrada, tributos e fornecedores',
      icon: FileText,
      iconColor: 'text-purple-500 dark:text-purple-400',
      bgColor: 'bg-purple-500/10',
      badge: 'SF1 / SD1',
      prompt: 'Notas fiscais de entrada recentes agrupadas por fornecedor e valor total',
    },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-2 max-w-3xl mx-auto animate-in fade-in duration-500">
      {/* Brand & Boas-vindas Executivas */}
      <div className="text-center mb-6 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-1">
          <Sparkles size={13} className="text-[#2563FF] animate-pulse" />
          <span>Executive Intelligence Platform 3.0</span>
        </div>
        
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Bem-vindo ao Copilot Executivo
        </h2>
        
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Analise dados Financeiros, Comerciais, Estoque, Compras, Fiscal e Controladoria em tempo real com garantia de leitura e zero alucinação no Protheus.
        </p>
      </div>

      {/* Grid de Mini Cards (Wireframe Seção 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-4">
        {domainCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              disabled={isGenerating}
              onClick={() => handleAction(card.prompt)}
              className="group p-4 text-left rounded-2xl glass-card-executive cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.iconColor} shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {card.title}
                      </h3>
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        {card.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {card.description}
                    </p>
                  </div>
                </div>

                <ArrowUpRight 
                  size={15} 
                  className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-0.5" 
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Action Chips Rápidos */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-2">
        <span className="text-[11px] font-semibold text-slate-400 mr-1">Sugestões rápidas:</span>
        {[
          "Extrato do maior devedor",
          "Projeção de fluxo de caixa",
          "Ranking de clientes",
          "Inadimplência acima de 60 dias"
        ].map((text) => (
          <button
            key={text}
            type="button"
            disabled={isGenerating}
            onClick={() => handleAction(text)}
            className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}


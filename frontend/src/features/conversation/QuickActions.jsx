import React from 'react';
import { Sparkles } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

/**
 * Estado Inicial — Copilot Executivo Minimal
 * Inspirado em Apple Human Interface, Claude AI, Arc e Notion AI.
 * Sem caixas, sem bordas, sem cards. Apenas tipografia refinada e foco total.
 */
export function QuickActions() {
  const { triggerPrompt, isGenerating } = useDashboardStore();

  const handleAction = (promptText) => {
    if (isGenerating) return;
    triggerPrompt(promptText);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia.';
    if (hour < 18) return 'Boa tarde.';
    return 'Boa noite.';
  };

  const options = [
    {
      label: 'Fluxo de Caixa',
      prompt: 'Projeção de fluxo de caixa e recebimentos dos próximos 30 dias',
    },
    {
      label: 'Vendas',
      prompt: 'Faturamento acumulado do mês atual comparado por vendedor',
    },
    {
      label: 'Clientes',
      prompt: 'Clientes com títulos vencidos acima de 60 dias e risco de inadimplência',
    },
    {
      label: 'Estoque',
      prompt: 'Identificar produtos parados sem movimentação nos últimos 90 dias com saldo em estoque',
    },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-12 px-6 max-w-lg mx-auto select-none animate-in fade-in duration-300">
      {/* Brand Minimalista */}
      <div className="text-center mb-10 space-y-1">
        <div className="inline-flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-lg sm:text-xl">
          <Sparkles size={18} className="text-[#4F7CFF]" />
          <span>Copilot Protheus</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-normal">
          Inteligência Corporativa
        </p>
      </div>

      {/* Saudação e Pergunta Central */}
      <div className="text-center mb-8 space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {getGreeting()}
        </h2>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-normal">
          O que deseja analisar hoje?
        </p>
      </div>

      {/* Lista de Opções em Texto Puro (Sem cards, sem caixas, sem bordas) */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {options.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={isGenerating}
            onClick={() => handleAction(item.prompt)}
            className="w-full py-1.5 text-center text-sm sm:text-base font-normal text-slate-600 dark:text-slate-300 hover:text-[#4F7CFF] dark:hover:text-[#4F7CFF] hover:translate-x-0.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

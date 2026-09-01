import React from 'react';
import {
  SlidersHorizontal,
  TrendingUp,
  Percent,
  DollarSign,
  Sparkles,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';

export default function ScenarioSimulator() {
  const {
    simulationPriceDelta,
    setSimulationPriceDelta,
    simulationDelinquencyDelta,
    setSimulationDelinquencyDelta,
    simulationCostDelta,
    setSimulationCostDelta,
    simulatedEbitdaImpact,
    sendMessage,
  } = useExecutive();

  const handleReset = () => {
    setSimulationPriceDelta(0);
    setSimulationDelinquencyDelta(0);
    setSimulationCostDelta(0);
  };

  const handleAskCopilot = () => {
    sendMessage(
      `Analisar projeção executiva com variações simuladas: Preço (${simulationPriceDelta >= 0 ? '+' : ''}${simulationPriceDelta}%), Inadimplência (${simulationDelinquencyDelta >= 0 ? '+' : ''}${simulationDelinquencyDelta}%) e Custos (${simulationCostDelta >= 0 ? '+' : ''}${simulationCostDelta}%). Qual a viabilidade orçamentária no ERP Protheus?`
    );
  };

  const isPositive = simulatedEbitdaImpact.amount >= 0;

  return (
    <section id="scenario-simulator-section" className="rounded-3xl glass-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Simulador Executivo de Cenários & Previsão "What-If"
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste as variáveis de mercado para estimar a sensibilidade imediata no EBITDA e na margem líquida.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Resetar</span>
          </button>
          <button
            onClick={handleAskCopilot}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0F66FF] hover:bg-[#0E5CE0] text-white text-xs font-bold shadow-md shadow-[#0F66FF]/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Avaliar com Copiloto</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-center">
        {/* Sliders (3 Columns) */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Price Delta Slider */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#0F66FF]" />
                Variação de Preço Médio
              </span>
              <span className="font-mono text-[#0F66FF] font-black text-sm">
                {simulationPriceDelta >= 0 ? '+' : ''}
                {simulationPriceDelta}%
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="15"
              step="0.5"
              value={simulationPriceDelta}
              onChange={e => setSimulationPriceDelta(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0F66FF]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>-10%</span>
              <span>0% (Atual)</span>
              <span>+15%</span>
            </div>
          </div>

          {/* Cost Delta Slider */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-amber-500" />
                Custos de Insumos (COGS)
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-black text-sm">
                {simulationCostDelta >= 0 ? '+' : ''}
                {simulationCostDelta}%
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="15"
              step="0.5"
              value={simulationCostDelta}
              onChange={e => setSimulationCostDelta(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>-10%</span>
              <span>0% (Atual)</span>
              <span>+15%</span>
            </div>
          </div>

          {/* Delinquency Slider */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                Inadimplência da Carteira
              </span>
              <span className="font-mono text-rose-600 dark:text-rose-400 font-black text-sm">
                {simulationDelinquencyDelta >= 0 ? '+' : ''}
                {simulationDelinquencyDelta}%
              </span>
            </div>
            <input
              type="range"
              min="-3"
              max="5"
              step="0.2"
              value={simulationDelinquencyDelta}
              onChange={e => setSimulationDelinquencyDelta(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>-3%</span>
              <span>0% (2.1%)</span>
              <span>+5%</span>
            </div>
          </div>
        </div>

        {/* Dynamic Impact Display Box */}
        <div
          className={`p-4 rounded-2xl border text-center transition-all ${
            isPositive
              ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30'
              : 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Impacto Projetado no EBITDA
          </div>
          <div
            className={`text-2xl font-black tracking-tight mt-1 ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {simulatedEbitdaImpact.formatted}
          </div>
          <div className="text-[11px] font-bold mt-1 text-slate-600 dark:text-slate-300">
            Margem EBITDA: {isPositive ? '+' : ''}
            {simulatedEbitdaImpact.marginDelta}%
          </div>
        </div>
      </div>
    </section>
  );
}

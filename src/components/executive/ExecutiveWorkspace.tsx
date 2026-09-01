import React from 'react';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Building2,
  DollarSign,
  ShoppingCart,
  Boxes,
  Activity,
  Layers,
  ArrowUpRight,
  Download,
  Clock,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';
import { ExecutiveDomain } from '../../types/executive';
import ExecutiveKpiGrid from './ExecutiveKpiGrid';
import StrategicInsightsSection from './StrategicInsightsSection';
import VisualAnalyticsSuite from './VisualAnalyticsSuite';
import ScenarioSimulator from './ScenarioSimulator';
import EnterpriseDataGrids from './EnterpriseDataGrids';

export default function ExecutiveWorkspace() {
  const {
    selectedCompany,
    selectedBranch,
    activeDomain,
    setActiveDomain,
    timeRange,
    setExportModalOpen,
  } = useExecutive();

  const domainTabs: { id: ExecutiveDomain; label: string; icon: any }[] = [
    { id: 'overview', label: 'Visão Executiva Geral', icon: Activity },
    { id: 'financial', label: 'Saúde Financeira & Caixa', icon: DollarSign },
    { id: 'commercial', label: 'Comercial & Vendas (FAT)', icon: ShoppingCart },
    { id: 'inventory', label: 'Estoque & Suprimentos (EST)', icon: Boxes },
  ];

  return (
    <div
      id="executive-main-workspace"
      className="flex-1 w-full p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1920px] mx-auto transition-all"
    >
      {/* SECTION 1: Executive Briefing & Synopsis Bar */}
      <div className="relative rounded-3xl p-6 glass-card overflow-hidden gradient-border">
        {/* Background glow orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#0F66FF]/15 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#0F66FF]/10 text-[#0F66FF] dark:text-blue-400 border border-[#0F66FF]/20">
                <Sparkles className="w-3.5 h-3.5 text-[#0F66FF] dark:text-blue-400 animate-pulse" />
                SÍNTESE EXECUTIVA DE INTELIGÊNCIA
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Atualizado há 3 minutos
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Painel Corporativo Consolidado — {selectedCompany.name}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              O faturamento acumulado no período atingiu <strong className="text-[#0F66FF] dark:text-blue-400 font-bold">R$ 28,45M (+12%)</strong> com margem EBITDA sólida de <strong className="text-emerald-600 dark:text-emerald-400 font-bold">27,0%</strong>. A liquidez de tesouraria cobre <strong className="text-slate-900 dark:text-white font-bold">74 dias</strong> de despesas operacionais, com taxa de inadimplência controlada em <strong className="text-emerald-600 dark:text-emerald-400 font-bold">2,1%</strong>.
            </p>
          </div>

          {/* Quick macro cards */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-center min-w-[130px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Margem EBITDA</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">27,0%</div>
              <div className="text-[10px] font-semibold text-slate-500">+220 bps vs orçado</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-center min-w-[130px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Run-rate Anual</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">R$ 341M</div>
              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">+14,8% vs 2025</div>
            </div>
          </div>
        </div>

        {/* Domain Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
          {domainTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeDomain === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDomain(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#0F66FF] text-white shadow-md shadow-[#0F66FF]/25 ring-2 ring-[#0F66FF]/30'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: KPI Cards */}
      <ExecutiveKpiGrid />

      {/* SECTION 3: Strategic AI Insights */}
      <StrategicInsightsSection />

      {/* SECTION 4: Visual Analytics Suite */}
      <VisualAnalyticsSuite />

      {/* SECTION 5: Scenario Simulator "What-If" */}
      <ScenarioSimulator />

      {/* SECTION 6: Enterprise Datagrids */}
      <EnterpriseDataGrids />
    </div>
  );
}

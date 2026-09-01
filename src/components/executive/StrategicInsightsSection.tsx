import React from 'react';
import {
  Zap,
  AlertTriangle,
  AlertOctagon,
  Info,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';
import { ExecutiveInsight } from '../../types/executive';

export default function StrategicInsightsSection() {
  const { insights, setSimulationPriceDelta, setSelectedInsightForDetail, sendMessage } = useExecutive();

  return (
    <section id="strategic-insights-section" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Diagnósticos Estratégicos & Recomendações da IA (Zero Alucinação)
            </h3>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          5 Recomendações Ativas · Rastreabilidade em Tempo Real
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {insights.map(insight => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onSimulate={() => {
              if (insight.id === 'ins-01') {
                setSimulationPriceDelta(4.5);
                sendMessage('Simular o impacto do reajuste de 4.5% no preço de bombas industriais conforme Insight #01.');
              } else {
                sendMessage(`Analisar em profundidade a recomendação executiva: "${insight.title}" com base nas tabelas Protheus.`);
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}

function InsightCard({
  insight,
  onSimulate,
}: {
  insight: ExecutiveInsight;
  onSimulate: () => void;
}) {
  const typeConfigs = {
    opportunity: {
      icon: TrendingUp,
      badge: 'Oportunidade',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      borderAccent: 'border-l-4 border-l-emerald-500',
      gradient: 'from-emerald-500/5 to-transparent',
    },
    critical: {
      icon: AlertOctagon,
      badge: 'Crítico / Risco',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      borderAccent: 'border-l-4 border-l-rose-500',
      gradient: 'from-rose-500/5 to-transparent',
    },
    alert: {
      icon: AlertTriangle,
      badge: 'Atenção',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      borderAccent: 'border-l-4 border-l-amber-500',
      gradient: 'from-amber-500/5 to-transparent',
    },
    information: {
      icon: Info,
      badge: 'Conformidade',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      borderAccent: 'border-l-4 border-l-blue-500',
      gradient: 'from-blue-500/5 to-transparent',
    },
  };

  const config = typeConfigs[insight.type] || typeConfigs.information;
  const IconComponent = config.icon;

  return (
    <div
      id={`insight-card-${insight.id}`}
      className={`relative rounded-2xl glass-card p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${config.borderAccent}`}
    >
      <div>
        {/* Top Header: Badge, Confidence, Priority */}
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${config.badgeBg}`}>
            <IconComponent className="w-3 h-3" />
            {config.badge}
          </span>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" />
              {insight.confidenceScore}%
            </span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-1.5">
          {insight.title}
        </h4>

        {/* Description */}
        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-3">
          {insight.description}
        </p>
      </div>

      <div>
        {/* Business Impact Box */}
        <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Impacto Financeiro
          </div>
          <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
            {insight.businessImpact}
          </div>
        </div>

        {/* Recommendation & Protheus Source Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
          <span className="font-mono text-slate-400 truncate max-w-[120px]">
            {insight.protheusSource.split('(')[0]}
          </span>

          <button
            onClick={onSimulate}
            className="inline-flex items-center gap-1 text-[#0F66FF] dark:text-blue-400 font-bold hover:underline"
          >
            <span>Ação</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

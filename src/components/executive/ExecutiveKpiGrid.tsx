import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Database,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';
import { ExecutiveKpi } from '../../types/executive';

export default function ExecutiveKpiGrid() {
  const { kpis, comparisonMode, setComparisonMode, setSelectedInsightForDetail } = useExecutive();

  return (
    <div id="executive-kpi-section" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F66FF] animate-ping" />
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Indicadores Chave de Desempenho (KPIs Primários)
          </h3>
        </div>

        {/* Comparison toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold">
          <button
            onClick={() => setComparisonMode('previous')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              comparisonMode === 'previous'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            vs Período Anterior
          </button>
          <button
            onClick={() => setComparisonMode('budget')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              comparisonMode === 'budget'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            vs Orçado (Budget SIGAPCO)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpis.map((kpi, idx) => (
          <KpiCard key={kpi.id} kpi={kpi} index={idx} />
        ))}
      </div>
    </div>
  );
}

function KpiCard({ kpi, index }: { kpi: ExecutiveKpi; index: number }) {
  const isPositiveTrend = kpi.trend === 'up' ? kpi.status === 'positive' : kpi.status === 'positive';
  const trendSign = kpi.changePercent >= 0 ? '+' : '';

  return (
    <div
      id={`kpi-card-${kpi.id}`}
      className="group relative rounded-2xl glass-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#0F66FF]/40 cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      {/* Top row: Title and Protheus Source */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 line-clamp-1 group-hover:text-[#0F66FF] dark:group-hover:text-blue-400 transition-colors">
            {kpi.title}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-semibold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
            <Database className="w-2.5 h-2.5" />
            {kpi.protheusTable.split('/')[0]}
          </span>
        </div>

        {/* Value */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
            {kpi.formattedValue}
          </span>
        </div>
      </div>

      {/* Sparkline & Trend */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
              kpi.changePercent >= 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {kpi.changePercent >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>
              {trendSign}
              {kpi.changePercent}%
            </span>
          </div>

          {/* Mini Sparkline SVG */}
          <div className="w-16 h-5">
            <MiniSparkline data={kpi.sparkline} isPositive={kpi.changePercent >= 0} />
          </div>
        </div>

        <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
          {kpi.comparisonLabel}
        </div>
      </div>

      {/* Subtle bottom gradient accent on hover */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#0F66FF] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 20;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = isPositive ? '#10B981' : '#F43F5E';

  return (
    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

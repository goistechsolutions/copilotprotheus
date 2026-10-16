import React from 'react';
import { AlertTriangle, CheckCircle2, Info, AlertCircle, Sparkles } from 'lucide-react';

export function ExecutiveInsightsCard({ insights = [], backendKpis = null }) {
  // Se não houver insights diretos, podemos sintetizar a partir dos dados do backend_kpis
  const displayInsights = React.useMemo(() => {
    if (insights && insights.length > 0) {
      return insights;
    }
    const derived = [];
    if (backendKpis) {
      if (backendKpis.concentration && backendKpis.concentration > 30) {
        derived.push({
          severity: 'WARNING',
          title: 'Concentração de Volume',
          description: `O elemento líder (${backendKpis.maior_ocorrencia_nome || 'Top 1'}) concentra ${backendKpis.concentration.toFixed(1)}% do faturamento total.`,
          score: 80,
        });
      }
      if (backendKpis.top5_share && backendKpis.top5_share > 50) {
        derived.push({
          severity: 'INFO',
          title: 'Representatividade Top 5',
          description: `Os 5 principais registros respondem por ${backendKpis.top5_share.toFixed(1)}% da movimentação da empresa.`,
          score: 60,
        });
      }
    }
    return derived;
  }, [insights, backendKpis]);

  if (!displayInsights || displayInsights.length === 0) return null;

  const getSeverityStyle = (severity = 'INFO') => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return {
          icon: <AlertCircle size={14} className="text-rose-500 shrink-0" />,
          badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          borderClass: 'border-l-rose-500',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle size={14} className="text-amber-500 shrink-0" />,
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          borderClass: 'border-l-amber-500',
        };
      case 'SUCCESS':
        return {
          icon: <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          borderClass: 'border-l-emerald-500',
        };
      case 'INFO':
      default:
        return {
          icon: <Info size={14} className="text-blue-500 shrink-0" />,
          badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          borderClass: 'border-l-blue-500',
        };
    }
  };

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs my-2.5 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-500/15 text-purple-500">
          <Sparkles size={12} />
        </div>
        <span className="text-xs font-bold text-[var(--color-text)]">
          Diagnósticos & Insights Executivos
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {displayInsights.slice(0, 3).map((item, idx) => {
          const style = getSeverityStyle(item.severity);
          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--color-border)]/60 border-l-3 ${style.borderClass} transition-colors`}
            >
              <div className="mt-0.5">{style.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[var(--color-text)] truncate">
                    {item.title}
                  </span>
                  {item.value && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${style.badgeClass}`}>
                      {item.value}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExecutiveInsightsCard;

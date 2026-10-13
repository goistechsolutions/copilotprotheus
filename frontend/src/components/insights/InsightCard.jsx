import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Lightbulb, TrendingUp, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';

export function InsightCard({ title, description, value, type = 'information', severity = 'info' }) {
  const getStyleAndIcon = () => {
    const norm = (type || severity || '').toLowerCase();
    
    if (norm === 'critical' || norm === 'danger') {
      return {
        icon: <AlertCircle size={18} className="text-red-500 shrink-0" />,
        badge: 'Crítico',
        badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
        border: 'border-red-500/30',
        indicator: 'bg-red-500',
      };
    }
    
    if (norm === 'warning' || norm === 'alert' || norm === 'attention') {
      return {
        icon: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
        badge: 'Atenção',
        badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        border: 'border-amber-500/30',
        indicator: 'bg-amber-500',
      };
    }

    if (norm === 'success' || norm === 'opportunity' || norm === 'positive') {
      return {
        icon: <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />,
        badge: 'Positivo',
        badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        border: 'border-emerald-500/30',
        indicator: 'bg-emerald-500',
      };
    }

    return {
      icon: <Lightbulb size={18} className="text-[var(--brand)] shrink-0" />,
      badge: 'Insight',
      badgeClass: 'bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20',
      border: 'border-[var(--border)]',
      indicator: 'bg-[var(--brand)]',
    };
  };

  const style = getStyleAndIcon();

  return (
    <div className={`p-3.5 rounded-xl bg-[var(--surface-1)] border ${style.border} hover:border-[var(--border-hover)] transition-all shadow-2xs flex flex-col justify-between gap-2`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {style.icon}
            <h4 className="text-xs font-bold text-[var(--text-primary)] truncate" title={title}>
              {title}
            </h4>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${style.badgeClass}`}>
            {style.badge}
          </span>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>

      {value && (
        <div className="pt-2 border-t border-[var(--border)] mt-1 flex items-center justify-between">
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Impacto</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
        </div>
      )}
    </div>
  );
}

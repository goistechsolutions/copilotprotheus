import React from 'react';
import { TrendingUp, User, DollarSign, BarChart2 } from 'lucide-react';

export function KPICard({ 
  label, 
  value, 
  trend, 
  iconType = 'chart',
  className = '' 
}) {
  const getIcon = () => {
    switch (iconType) {
      case 'user':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <User size={14} />
          </div>
        );
      case 'money':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <DollarSign size={14} />
          </div>
        );
      case 'chart':
      default:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BarChart2 size={14} />
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col justify-between p-3.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-muted)] truncate">
          {label}
        </span>
      </div>

      <div>
        <div className="text-base sm:text-lg font-extrabold text-[var(--color-text)] tracking-tight truncate">
          {value}
        </div>

        {trend && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            <TrendingUp size={11} />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default KPICard;

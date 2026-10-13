import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon: Icon, 
  color = 'blue',
  isHero = false,
  onClick
}) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp size={16} className="text-emerald-500" />;
    if (trend === 'down') return <TrendingDown size={16} className="text-red-500" />;
    return <Minus size={16} className="text-slate-400" />;
  };

  const getColorClasses = () => {
    switch (color) {
      case 'emerald': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'amber': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      case 'red': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'purple': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'blue':
      default: return 'text-[var(--brand)] bg-blue-50 dark:bg-blue-900/20 dark:text-[var(--brand)]';
    }
  };

  return (
    <Card 
      onClick={onClick}
      className={`flex flex-col justify-between overflow-hidden relative group transition-all ${
        onClick ? 'cursor-pointer hover:border-[var(--border-hover)] hover:-translate-y-0.5' : ''
      } ${
        isHero 
          ? 'border-[var(--brand)]/40 bg-gradient-to-br from-[var(--surface-1)] via-[var(--surface-1)] to-[var(--surface-2)] shadow-md' 
          : 'bg-[var(--surface-1)] border-[var(--border)]'
      }`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none">
        {Icon && <Icon size={isHero ? 80 : 64} className="text-[var(--text-primary)]" />}
      </div>

      <CardContent className="p-0 z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className={`p-2 rounded-xl shrink-0 ${getColorClasses()}`}>
                <Icon size={isHero ? 20 : 17} />
              </div>
            )}
            <h3 
              className={`font-semibold tracking-wider uppercase truncate ${
                isHero 
                  ? 'text-xs text-[var(--brand)] font-bold' 
                  : 'text-xs text-[var(--text-muted)]'
              }`} 
              title={title}
            >
              {title}
            </h3>
          </div>

          {onClick && (
            <ArrowUpRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--brand)] transition-colors shrink-0" />
          )}
        </div>
        
        <div className="flex items-end justify-between mt-3">
          <div className="min-w-0 flex-1">
            <p className={`font-extrabold text-[var(--text-primary)] tracking-tight truncate ${
              isHero ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
            }`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs font-medium text-[var(--text-muted)] mt-1 truncate max-w-[260px]" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          
          {trendValue && (
            <div className="flex items-center gap-1 text-xs font-semibold shrink-0 ml-2 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5">
              {getTrendIcon()}
              <span className={trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

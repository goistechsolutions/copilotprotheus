import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

export function MetricCard({ title, value, subtitle, trend, trendValue, icon: Icon, color = 'blue' }) {
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
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <Card className="flex flex-col justify-between overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        {Icon && <Icon size={64} className="text-slate-900 dark:text-white" />}
      </div>
      <CardContent className="p-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          {Icon && (
            <div className={`p-2 rounded-lg shrink-0 ${getColorClasses()}`}>
              <Icon size={18} />
            </div>
          )}
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={title}>{title}</h3>
        </div>
        
        <div className="flex items-end justify-between mt-4">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
            {subtitle && (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[220px]" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          
          {trendValue && (
            <div className="flex items-center gap-1 text-sm font-medium shrink-0 ml-2">
              {getTrendIcon()}
              <span className={trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

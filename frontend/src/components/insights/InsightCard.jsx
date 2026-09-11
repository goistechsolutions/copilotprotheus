import React from 'react';
import { AlertCircle, CheckCircle2, Lightbulb, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';

export function InsightCard({ title, description, value, type = 'information' }) {
  
  const getStyleAndIcon = () => {
    switch (type) {
      case 'critical':
        return {
          icon: <AlertCircle size={24} className="text-red-500" />,
          bg: 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30',
          titleColor: 'text-red-800 dark:text-red-400',
          valueColor: 'text-red-700 dark:text-red-300'
        };
      case 'opportunity':
        return {
          icon: <TrendingUp size={24} className="text-emerald-500" />,
          bg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30',
          titleColor: 'text-emerald-800 dark:text-emerald-400',
          valueColor: 'text-emerald-700 dark:text-emerald-300'
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={24} className="text-blue-500" />,
          bg: 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30',
          titleColor: 'text-blue-800 dark:text-blue-400',
          valueColor: 'text-blue-700 dark:text-blue-300'
        };
      case 'information':
      default:
        return {
          icon: <Lightbulb size={24} className="text-amber-500" />,
          bg: 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30',
          titleColor: 'text-amber-800 dark:text-amber-400',
          valueColor: 'text-amber-700 dark:text-amber-300'
        };
    }
  };

  const style = getStyleAndIcon();

  return (
    <Card className={`p-4 border ${style.bg} shadow-none`}>
      <div className="flex gap-4">
        <div className="shrink-0 mt-1">{style.icon}</div>
        <div className="flex-1">
          <h4 className={`text-sm font-bold ${style.titleColor}`}>{title}</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
          {value && (
            <p className={`mt-3 text-lg font-bold ${style.valueColor}`}>{value}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

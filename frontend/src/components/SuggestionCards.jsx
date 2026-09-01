import React from 'react';
import {
  TrendingUp,
  CreditCard,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const iconMap = {
  0: TrendingUp,
  1: CreditCard,
  2: Package,
  3: AlertTriangle,
};

const badgeColors = {
  0: 'from-blue-500 to-indigo-600',
  1: 'from-emerald-500 to-teal-600',
  2: 'from-amber-500 to-orange-600',
  3: 'from-rose-500 to-pink-600',
};

export default function SuggestionCards({ items, disabled, onPick }) {
  return (
    <section className="w-full" aria-labelledby="suggestions-title">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <p id="suggestions-title" className="text-[14px] font-bold text-slate-800 tracking-tight">
            Consultas Rápidas no ERP
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Sugestões de Negócio
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item, index) => {
          const Icon = iconMap[index % 4] || FileSpreadsheet;
          const gradient = badgeColors[index % 4] || 'from-indigo-500 to-purple-600';

          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item)}
              className="group relative flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm transition-transform group-hover:scale-105`}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-[13px] font-bold leading-tight text-slate-800 transition-colors group-hover:text-indigo-600">
                  {item.title}
                </strong>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                  {item.subtitle}
                </span>
              </div>
              <ArrowRight size={15} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

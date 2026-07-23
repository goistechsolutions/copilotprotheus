import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function QuickSuggestions({ items, onPick, disabled = false }) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`w-full max-w-3xl mx-auto mt-8 mb-4 px-6 animate-in slide-in-from-bottom-4 duration-500 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => !disabled && onPick(item)}
            disabled={disabled}
            className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-md transition-all text-left"
          >
            <div>
              <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{item.title}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
              <ArrowUpRight size={16} className="text-slate-400 group-hover:text-brand-500" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

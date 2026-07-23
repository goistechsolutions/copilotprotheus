import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function SuggestionGrid({ items, onSelect }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto my-8">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Sparkles size={16} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Sugestões de Consulta</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(item.title)}
            className="group relative flex flex-col text-left p-5 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom"></div>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{item.subtitle}</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-500 transform group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

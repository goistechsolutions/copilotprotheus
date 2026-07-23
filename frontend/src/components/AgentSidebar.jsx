import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

export default function AgentSidebar({ items, onSelect }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-brand-500" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sugestões Rápidas</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(item.title)}
            className="group flex flex-col text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom"></div>
            <div className="flex justify-between items-start w-full">
              <div className="pr-2">
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.subtitle}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500 transform group-hover:translate-x-1 transition-all flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

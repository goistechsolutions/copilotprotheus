import React from 'react';
import { Sparkles, FileText, BarChart2 } from 'lucide-react';

const prompts = [
  { icon: <Sparkles className="w-4 h-4 text-blue-500" />, text: "Resumo do financeiro hoje" },
  { icon: <FileText className="w-4 h-4 text-emerald-500" />, text: "Últimas notas emitidas" },
  { icon: <BarChart2 className="w-4 h-4 text-purple-500" />, text: "Análise de inadimplência" },
];

export default function QuickPrompts({ module, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sugestões para {module}</p>
      {prompts.map((p, idx) => (
        <button 
          key={idx} 
          onClick={() => onSelect(p.text)}
          className="flex items-center gap-3 w-full text-left p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50 transition-all group"
        >
          <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-white transition-colors">{p.icon}</div>
          <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{p.text}</span>
        </button>
      ))}
    </div>
  );
}

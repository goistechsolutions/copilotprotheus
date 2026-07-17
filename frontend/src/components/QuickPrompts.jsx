import React from 'react';
import { Zap } from 'lucide-react';

const SUGGESTIONS = [
  "Qual o faturamento deste mês?",
  "Títulos vencendo na próxima semana",
  "Top 5 produtos mais vendidos",
  "Clientes com maior risco de inadimplência"
];

export default function QuickPrompts({ onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4 justify-center">
      {SUGGESTIONS.map((prompt, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(prompt)}
          className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors shadow-sm"
        >
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          {prompt}
        </button>
      ))}
    </div>
  );
}

import React from 'react'
import { Sparkles } from 'lucide-react'

export default function SuggestionCards({ items, disabled, onPick }) { 
    return (
        <div className="w-full max-w-3xl mx-auto">
           <div className="flex items-center gap-2 mb-4 text-slate-400">
             <Sparkles size={16} className="text-amber-400" />
             <span className="text-sm font-medium">Sugestões rápidas</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((it, idx) => (
                <button key={idx} disabled={disabled} onClick={() => onPick(it)} className="flex flex-col text-left bg-slate-700/30 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 rounded-xl p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed group">
                    <strong className="text-slate-200 font-medium group-hover:text-blue-400 transition-colors text-sm">{it.title}</strong>
                    <span className="text-slate-400 text-xs mt-1">{it.subtitle}</span>
                </button>
            ))}
           </div>
        </div>
    ) 
}
import React from 'react'
import { FileText, TrendingUp, Calendar, BarChart2 } from 'lucide-react'

export default function SuggestionCards({ items, disabled, onPick }) {
    const icons = [FileText, TrendingUp, Calendar, BarChart2];
    
    return (
        <div className="w-full max-w-3xl mx-auto">
           <div className="mb-4 text-slate-700">
             <span className="text-lg font-semibold">Sugestões de consulta</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((it, idx) => {
                const Icon = icons[idx % icons.length];
                return (
                    <button key={idx} disabled={disabled} onClick={() => onPick(it)} className="flex flex-col text-left bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-2xl p-5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                            <Icon size={20} className="text-blue-600" />
                        </div>
                        <strong className="text-slate-800 font-semibold group-hover:text-blue-600 transition-colors text-base leading-snug mb-1">{it.title}</strong>
                        <span className="text-slate-500 text-sm">{it.subtitle}</span>
                    </button>
                )
            })}
           </div>
        </div>
    ) 
}
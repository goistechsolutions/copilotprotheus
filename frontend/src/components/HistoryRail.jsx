import React from 'react'
import { Plus, MessageSquare } from 'lucide-react'

export default function HistoryRail({ items, onSelect, onNew }) { 
    return (
        <aside className="w-64 bg-slate-900/80 border-r border-slate-700/60 flex flex-col h-full shrink-0">
            <div className="p-4 border-b border-slate-800/50">
                <button onClick={onNew} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-md hover:shadow-blue-500/20 active:scale-95 text-sm">
                    <Plus size={16} /> Nova conversa
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1 py-4">
                <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico</div>
                {items.map((it, idx) => (
                    <button key={idx} onClick={() => onSelect(it)} className="w-full flex flex-col text-left px-3 py-3 rounded-lg hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700/50">
                        <div className="flex items-center gap-2 text-slate-300 group-hover:text-blue-400">
                            <MessageSquare size={14} />
                            <span className="text-sm font-medium truncate leading-tight">{it.title}</span>
                        </div>
                        <small className="text-xs text-slate-500 ml-6 mt-1">{it.date}</small>
                    </button>
                ))}
            </div>
        </aside>
    ) 
}
import React from 'react';
import { PlusCircle, MessageSquare, History } from 'lucide-react';

export default function SideRail({ history = [], onSelect, onNew }) {
  return (
    <div className="w-[240px] shrink-0 bg-slate-900 text-slate-300 flex flex-col h-full overflow-hidden shadow-2xl z-30">
      
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 bg-slate-950/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-inner">
          <span className="font-bold text-sm">P</span>
        </div>
        <h2 className="text-sm font-bold text-white tracking-wide">Copilot</h2>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-4">
        <button 
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-lg transition-colors font-medium text-sm shadow-sm"
        >
          <PlusCircle size={16} />
          <span>Nova Análise</span>
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
        <div className="flex items-center gap-2 px-2 pt-2 pb-3 text-slate-500">
          <History size={14} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Recentes</span>
        </div>
        
        <div className="space-y-1">
          {history.length === 0 ? (
            <div className="px-2 py-4 text-xs text-slate-600 text-center">Nenhum histórico salvo.</div>
          ) : (
            history.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(item)}
                className="w-full flex flex-col text-left px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors group"
              >
                <div className="flex items-center gap-2 w-full">
                  <MessageSquare size={14} className="text-slate-500 group-hover:text-brand-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-200 truncate">{item.title}</span>
                </div>
                <span className="text-[10px] text-slate-500 pl-6 mt-1">{item.date}</span>
              </button>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
}

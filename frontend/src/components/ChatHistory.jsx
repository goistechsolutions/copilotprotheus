import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function ChatHistory({ history, onSelect }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-slate-500">
        Nenhum histórico recente.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {history.map((item, idx) => (
        <button 
          key={idx}
          onClick={() => onSelect(item)}
          className="flex items-center gap-3 p-3 w-full text-left rounded-xl hover:bg-slate-100 transition-colors"
        >
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-700 truncate">{item.title || "Nova conversa"}</p>
            <p className="text-[11px] text-slate-500 truncate">{item.date || "Hoje"}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

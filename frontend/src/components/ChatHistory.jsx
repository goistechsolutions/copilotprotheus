import React from 'react';
import { MessageSquare, Clock, ArrowRight } from 'lucide-react';

export default function ChatHistory({ history, onSelect }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-4">
        Nenhum histórico recente.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((item, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(item)}
          className="flex flex-col gap-1 text-left p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group bg-white shadow-sm"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-semibold text-slate-700 truncate pr-2 group-hover:text-blue-700">
              {item.title}
            </span>
            <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.date}
            </span>
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">
              {item.module}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

import React from 'react';
import { User, Sparkles } from 'lucide-react';

export default function ChatMessage({ message, isUser, profile }) {
  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-slate-200' : 'bg-blue-600'}`}>
          {isUser ? <User className="w-4 h-4 text-slate-600" /> : <Sparkles className="w-4 h-4 text-white" />}
        </div>
        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
          {message.file && (
            <div className="text-xs bg-black/10 px-2 py-1 rounded-md mb-2 flex items-center gap-1">
               📎 {message.file}
            </div>
          )}
          <div className="whitespace-pre-wrap">{message.text || message.executive_summary || "..."}</div>
        </div>
      </div>
    </div>
  );
}

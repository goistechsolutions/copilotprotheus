import React from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ role, text }) {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mt-1 ${isUser ? 'bg-slate-200 text-slate-600' : 'bg-brand-600 text-white'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div className={`px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
          isUser 
            ? 'bg-slate-800 text-white rounded-2xl rounded-tr-sm' 
            : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{text}</div>
          ) : (
            <div className="prose prose-sm prose-slate max-w-none">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

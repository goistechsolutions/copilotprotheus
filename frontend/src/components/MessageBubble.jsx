import React from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ role, text }) {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mt-1 bg-blue-50 text-blue-600">
            <Bot size={16} />
            </div>
        )}
        <div className={`px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
          isUser 
            ? 'bg-blue-600 text-white rounded-[20px] rounded-br-sm' 
            : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-[20px] rounded-bl-sm'
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

import React, { forwardRef } from 'react';
import MessageBubble from './MessageBubble';

const ConversationList = forwardRef(({ messages, loading }, ref) => {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar scroll-smooth">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} text={m.text} />
        ))}
        {loading && (
          <div className="flex w-full mb-6 justify-start">
            <div className="flex max-w-[85%] gap-3 flex-row">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm mt-1 bg-brand-600 text-white">
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce"></span>
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                </div>
              </div>
              <div className="px-4 py-3 text-[13px] bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-sm italic shadow-sm">
                Buscando no ERP...
              </div>
            </div>
          </div>
        )}
        <div ref={ref} />
      </div>
    </div>
  );
});

export default ConversationList;

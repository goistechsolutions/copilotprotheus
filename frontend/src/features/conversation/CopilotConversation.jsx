import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function CopilotConversation() {
  const { chat } = useDashboardStore();
  const scrollRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages]);

  return (
    <div className="flex-1 overflow-y-auto p-5" ref={scrollRef}>
      {/* Mensagem Inicial */}
      {chat.messages.length === 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
          <p>Olá! Eu sou o Copiloto Executivo. O que você gostaria de analisar hoje?</p>
        </div>
      )}

      {/* Lista de Mensagens */}
      <div className="flex flex-col gap-6 mt-4">
        {chat.messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              msg.role === 'user' 
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' 
                : 'bg-blue-600 text-white'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            {/* Balão de Mensagem */}
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
              }`}>
                {msg.content}
              </div>
              <span className="mt-1 text-[10px] text-slate-400">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

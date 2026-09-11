import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function PromptInput() {
  const [input, setInput] = useState('');
  const { addChatMessage } = useDashboardStore();

  const handleSend = () => {
    if (!input.trim()) return;
    
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    });
    
    setInput('');
    
    // Simula uma resposta do sistema (temporário até conectar a IA real da v3.0)
    setTimeout(() => {
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Entendido. Estou processando sua solicitação e montando o novo dashboard...',
        timestamp: new Date().toISOString()
      });
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800/60 bg-white dark:bg-slate-900">
      <div className="relative flex items-end rounded-xl border border-slate-300 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-blue-500">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-32 min-h-[44px] w-full resize-none bg-transparent py-3 pl-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          placeholder="Pergunte ao Protheus..."
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          <Send size={16} className={input.trim() ? "ml-0.5" : ""} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        O Copiloto pode cometer erros. Considere verificar as informações.
      </p>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function ChatComposer({ onSend, isLoading, placeholder = 'Faça sua pergunta sobre os dados do ERP...' }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSend = () => {
    if (value.trim() && !isLoading) {
      onSend(value.trim());
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full bg-white border-t border-slate-200 p-4 md:p-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-20">
      <div className="max-w-4xl mx-auto relative flex items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-2xl pl-5 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white focus:border-brand-500 transition-all resize-none shadow-inner custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className={`absolute right-2 bottom-2 p-2 rounded-xl flex items-center justify-center transition-all ${
            value.trim() && !isLoading 
              ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
        </button>
      </div>
      <div className="max-w-4xl mx-auto mt-2 text-center">
        <p className="text-[10px] text-slate-400 font-medium">A IA pode cometer erros. Verifique informações importantes no seu ERP.</p>
      </div>
    </div>
  );
}

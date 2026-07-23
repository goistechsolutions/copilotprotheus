import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function ChatPanel({ onSend, loading, placeholder = 'Qual análise você precisa?' }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSend = () => {
    if (value.trim() && !loading) {
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
    <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.05)]">
      <div className="relative flex items-end bg-slate-50 border border-slate-200 rounded-xl transition-all focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 shadow-inner">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={1}
          className="w-full bg-transparent text-slate-800 text-sm pl-4 pr-12 py-3.5 focus:outline-none resize-none custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || loading}
          className={`absolute right-2 bottom-2 p-2 rounded-lg flex items-center justify-center transition-all ${
            value.trim() && !loading 
              ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
        </button>
      </div>
      <div className="mt-2 text-center">
        <p className="text-[10px] text-slate-400 font-medium">O Copilot pode cometer erros. Verifique os dados no Protheus.</p>
      </div>
    </div>
  );
}

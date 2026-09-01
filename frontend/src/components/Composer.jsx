import { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Mic } from 'lucide-react';

export default function Composer({ disabled, onSend, placeholder }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-[#E2E8F0] dark:border-slate-800 p-2 flex items-end focus-within:ring-2 focus-within:ring-[#004FCE]/20 focus-within:border-[#004FCE] transition-all">
        {/* Attachment button */}
        <button
          type="button"
          aria-label="Anexar arquivo"
          title="Anexar arquivo"
          className="p-2.5 text-[#475569] dark:text-slate-400 hover:text-[#004FCE] dark:hover:text-[#60A5FA] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1 cursor-pointer shrink-0"
        >
          <Paperclip size={18} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="composer-input"
          name="composer-input"
          rows={1}
          disabled={disabled}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Pergunte sobre clientes, pedidos, financeiro, faturamento...'}
          aria-label="Pergunta para o Copiloto Protheus"
          className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] text-[#171C20] dark:text-white py-2 min-h-[44px] max-h-[160px] placeholder-[#475569]/70 dark:placeholder-slate-500 overflow-y-auto leading-relaxed"
        />

        {/* Voice button */}
        <button
          type="button"
          aria-label="Entrada por voz"
          title="Entrada por voz"
          className="p-2.5 text-[#475569] dark:text-slate-400 hover:text-[#004FCE] dark:hover:text-[#60A5FA] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-1 cursor-pointer shrink-0"
        >
          <Mic size={18} />
        </button>

        {/* Send button (Stitch Arrow Upward style) */}
        <button
          type="button"
          aria-label="Enviar pergunta"
          disabled={disabled || !value.trim()}
          onClick={submit}
          className="w-10 h-10 bg-[#004FCE] hover:bg-[#003EA6] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all ml-1 shadow-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Mic, Paperclip, Send } from 'lucide-react';

export default function Composer({ disabled, onSend, placeholder }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
      <div className="copiloto-composer relative p-3 transition-all">
        <textarea
          ref={textareaRef}
          id="composer-input"
          name="composer-input"
          rows={1}
          disabled={disabled}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Faça sua pergunta sobre o Protheus...'}
          aria-label="Pergunta para o Copiloto Executivo"
          className="w-full resize-none bg-transparent px-2 pt-1 pb-10 text-[13px] leading-relaxed text-[#1a334e] outline-none placeholder:text-[#94a3b6] disabled:cursor-not-allowed disabled:opacity-50 font-normal"
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Entrada de voz"
              title="Entrada de voz"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#8899aa] hover:bg-[#EEF3F8] hover:text-[#0F66FF] transition-colors"
            >
              <Mic size={17} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              aria-label="Anexar arquivo"
              title="Anexar arquivo"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#8899aa] hover:bg-[#EEF3F8] hover:text-[#0F66FF] transition-colors"
            >
              <Paperclip size={17} strokeWidth={1.8} />
            </button>
          </div>

          <button
            type="button"
            aria-label="Enviar pergunta"
            disabled={disabled || !value.trim()}
            onClick={submit}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F66FF] text-white shadow-md shadow-[#0F66FF]/25 hover:bg-[#0b54d6] active:scale-95 transition-all disabled:cursor-not-allowed disabled:bg-[#d8e2ec] disabled:text-[#94a3b6] disabled:shadow-none"
          >
            <Send size={15} strokeWidth={2.2} className="translate-x-[-0.5px] translate-y-[-0.5px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

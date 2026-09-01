import { useState } from 'react';
import { Mic, Paperclip, SendHorizontal } from 'lucide-react';

export default function Composer({ disabled, onSend, placeholder }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full">
      <div className="relative rounded-[22px] border border-[#dce7f1] bg-white p-2 shadow-[0_8px_24px_rgba(47,83,119,0.08)] transition-shadow focus-within:border-[#a9ccec] focus-within:shadow-[0_10px_28px_rgba(45,119,188,0.13)]">
        <textarea
          id="composer-input"
          name="composer-input"
          rows={2}
          disabled={disabled}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Pergunta para o Copilot Protheus"
          className="min-h-[74px] w-full resize-none bg-transparent px-3 pb-10 pt-2 text-[13px] leading-relaxed text-[#203c60] outline-none placeholder:text-[#94a3b6] disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="absolute bottom-2.5 left-3 flex items-center gap-1">
          <button
            type="button"
            aria-label="Usar entrada de voz"
            title="Entrada de voz"
            disabled
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#8295aa] transition-colors hover:bg-[#f1f6fb] hover:text-[#356f9f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mic size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Anexar arquivo"
            title="Anexar arquivo"
            disabled
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#8295aa] transition-colors hover:bg-[#f1f6fb] hover:text-[#356f9f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Paperclip size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          aria-label="Enviar pergunta"
          disabled={disabled || !value.trim()}
          onClick={submit}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#2379c9] text-white shadow-[0_4px_10px_rgba(35,121,201,0.25)] transition-all hover:bg-[#176bb8] focus:outline-none focus:ring-2 focus:ring-[#2379c9]/30 active:scale-95 disabled:cursor-not-allowed disabled:bg-[#dfe8f1] disabled:text-[#9aabba] disabled:shadow-none"
        >
          <SendHorizontal size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-[#9aaabd]">
        A IA pode cometer erros. Verifique as informações antes de tomar decisões.
      </p>
    </div>
  );
}

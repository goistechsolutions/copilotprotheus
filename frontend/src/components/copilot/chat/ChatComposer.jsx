import React, { useState, useRef } from 'react';
import { Send, Paperclip, Square } from 'lucide-react';

export function ChatComposer({ 
  onSend, 
  onStop, 
  isProcessing = false, 
  placeholder = 'Pergunte ao Copilot...' 
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <footer className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 z-10">
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 shadow-xs transition-all">
        {/* Ícone de Anexo 📎 */}
        <button
          type="button"
          className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer rounded-xl"
          title="Anexar arquivo"
        >
          <Paperclip size={17} />
        </button>

        {/* Campo de Entrada */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={isProcessing ? 'Processando no Protheus...' : placeholder}
          rows={1}
          className="flex-1 bg-transparent text-[var(--color-text)] placeholder-[var(--color-muted)] text-xs sm:text-sm resize-none outline-none max-h-28 py-1 leading-relaxed"
        />

        {/* Botão de Envio ➤ ou Interrupção ⏹ */}
        {isProcessing ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors cursor-pointer shrink-0"
            title="Interromper"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#2563eb] text-white disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[#1d4ed8] transition-all cursor-pointer shrink-0 shadow-xs active:scale-95"
            title="Enviar mensagem"
          >
            <Send size={14} className="translate-x-[-0.5px]" />
          </button>
        )}
      </div>

      <div className="text-[10px] text-[var(--color-muted)] text-center mt-1.5 select-none">
        Enter para enviar • Shift + Enter para nova linha
      </div>
    </footer>
  );
}

export default ChatComposer;

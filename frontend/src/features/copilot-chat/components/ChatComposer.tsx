import React, { useState } from 'react';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { ArrowRightIcon, StopIcon } from './icons';
import { Sparkles, Plus, Command, CornerDownLeft } from 'lucide-react';

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onStopProcessing?: () => void;
  isProcessing: boolean;
  hasMessages: boolean;
  maxLength?: number;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  'Por que o saldo caiu?',
  'Quais clientes mais impactam?',
  'Compare com o mês anterior',
  'Mostre os títulos vencidos',
];

export function ChatComposer({
  onSendMessage,
  onStopProcessing,
  isProcessing,
  hasMessages,
  maxLength = 4000,
  suggestions,
}: ChatComposerProps) {
  const [input, setInput] = useState('');
  const [isCommandsOpen, setIsCommandsOpen] = useState(false);
  const { textareaRef } = useAutoResizeTextarea(input, 128);

  const activeSuggestions = suggestions && suggestions.length > 0 
    ? suggestions 
    : !hasMessages 
    ? DEFAULT_SUGGESTIONS 
    : [];

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;
    onSendMessage(trimmed);
    setInput('');
    setIsCommandsOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectSuggestion = (sug: string) => {
    onSendMessage(sug);
  };

  const handleCommandPick = (cmd: string) => {
    setInput(cmd + ' ');
    setIsCommandsOpen(false);
    textareaRef.current?.focus();
  };

  const placeholder = isProcessing
    ? 'Processando no Oracle Protheus...'
    : hasMessages
    ? 'Pergunte sobre estes dados...'
    : 'Pergunte ao Copilot Protheus...';

  return (
    <div className="flex flex-col items-center w-full shrink-0 px-3 pb-3 sm:px-6 sm:pb-4 bg-[var(--cprot-bg)] z-10">
      <div className="w-full max-w-[760px] flex flex-col gap-2">
        {/* Pílulas de Sugestões Contextuais */}
        {activeSuggestions.length > 0 && !isProcessing && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none animate-fade-in">
            <span className="text-[11px] font-semibold text-[var(--cprot-text-muted)] flex items-center gap-1 shrink-0 px-1">
              <Sparkles size={11} className="text-[var(--cprot-primary)]" />
              <span>Sugestões:</span>
            </span>
            {activeSuggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(sug)}
                className="px-2.5 py-1 rounded-full text-xs bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] hover:border-[var(--cprot-border-focus)] text-[var(--cprot-text-sub)] hover:text-[var(--cprot-text-main)] shrink-0 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Menu Rápido de Comandos */}
        {isCommandsOpen && (
          <div className="p-2 rounded-xl bg-[var(--cprot-surface)] border border-[var(--cprot-border)] shadow-lg flex flex-wrap gap-1.5 animate-slide-up">
            {[
              { label: '/faturamento', desc: 'Faturamento do mês' },
              { label: '/inadimplencia', desc: 'Títulos vencidos' },
              { label: '/clientes', desc: 'Clientes inativos' },
              { label: '/fluxocaixa', desc: 'Projeção de caixa' },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => handleCommandPick(c.label)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[var(--cprot-bg)] hover:bg-[var(--cprot-surface-hover)] text-[var(--cprot-text-main)] border border-[var(--cprot-border)] transition-colors cursor-pointer"
              >
                <span className="font-semibold text-[var(--cprot-primary)]">{c.label}</span>
                <span className="text-[10px] text-[var(--cprot-text-muted)]">— {c.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Caixa Principal do Composer */}
        <div className="relative flex flex-col rounded-2xl bg-[var(--cprot-surface)] border border-[var(--cprot-border)] focus-within:border-[var(--cprot-border-focus)] focus-within:ring-2 focus-within:ring-[var(--cprot-primary)]/15 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder={placeholder}
            rows={1}
            className="w-full px-4 pt-3 pb-2 bg-transparent text-[var(--cprot-text-main)] placeholder-[var(--cprot-text-muted)] text-sm resize-none outline-none max-h-32 leading-relaxed"
            aria-label="Mensagem para o Copilot"
          />

          {/* Barra de Ações Inferior do Composer */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCommandsOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  isCommandsOpen
                    ? 'bg-[var(--cprot-primary)]/15 text-[var(--cprot-primary)]'
                    : 'text-[var(--cprot-text-muted)] hover:text-[var(--cprot-text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Atalhos e comandos rápidos"
              >
                <Plus size={12} />
                <span>Comandos</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-[var(--cprot-text-muted)]">
                <span>Enter</span>
                <CornerDownLeft size={10} />
              </span>

              {isProcessing ? (
                <button
                  type="button"
                  onClick={onStopProcessing}
                  className="flex items-center justify-center h-8 w-8 rounded-xl bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors cursor-pointer"
                  title="Interromper processamento"
                  aria-label="Interromper processamento"
                >
                  <StopIcon size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-[var(--cprot-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="Enviar pergunta"
                  aria-label="Enviar pergunta"
                >
                  <span>Enviar</span>
                  <ArrowRightIcon size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { ArrowRightIcon, StopIcon } from './icons';

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onStopProcessing?: () => void;
  isProcessing: boolean;
  hasMessages: boolean;
  maxLength?: number;
}

export function ChatComposer({
  onSendMessage,
  onStopProcessing,
  isProcessing,
  hasMessages,
  maxLength = 4000,
}: ChatComposerProps) {
  const [input, setInput] = useState('');
  const { textareaRef } = useAutoResizeTextarea(input, 128);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;
    onSendMessage(trimmed);
    setInput('');
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

  const placeholder = isProcessing
    ? 'Processando no Oracle Protheus...'
    : hasMessages
    ? 'Continue a análise...'
    : 'Pergunte ao ERP...';

  return (
    <div className="copilot-chat-composer-wrapper">
      <div className="copilot-chat-composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={placeholder}
          rows={1}
          className="copilot-chat-textarea"
          aria-label="Mensagem para o Copilot"
        />

        {isProcessing ? (
          <button
            type="button"
            onClick={onStopProcessing}
            className="copilot-chat-action-btn copilot-chat-stop-btn"
            title="Interromper processamento"
            aria-label="Interromper processamento"
          >
            <StopIcon size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="copilot-chat-action-btn"
            title="Enviar pergunta (Enter)"
            aria-label="Enviar pergunta"
          >
            <ArrowRightIcon size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { MoreVerticalIcon, CloseIcon } from './icons';

interface ChatHeaderProps {
  onOpenMenu: () => void;
  onClose?: () => void;
  isConnected?: boolean;
}

export function ChatHeader({ onOpenMenu, onClose, isConnected = true }: ChatHeaderProps) {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('copilot:close'));
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'cprot-close' }, '*');
      }
    }
  };

  return (
    <header className="copilot-chat-header">
      {/* Brand & Connection */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/15 text-blue-500 font-bold text-xs select-none">
          ⚡
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--cprot-text-main)]">
            Copilot Protheus
          </span>
          {isConnected && (
            <span 
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" 
              title="Conectado ao Protheus"
            />
          )}
        </div>
      </div>

      {/* Ações: Menu Secundário e Fechar X */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenMenu}
          className="copilot-chat-header-btn"
          title="Menu de opções"
          aria-label="Abrir menu secundário"
        >
          <MoreVerticalIcon size={16} />
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="copilot-chat-header-btn hover:text-red-400"
          title="Fechar painel"
          aria-label="Fechar painel"
        >
          <CloseIcon size={16} />
        </button>
      </div>
    </header>
  );
}

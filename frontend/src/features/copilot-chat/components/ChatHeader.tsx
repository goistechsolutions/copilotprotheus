import React from 'react';
import { Menu, X } from 'lucide-react';

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
    <header className="copilot-chat-header flex items-center justify-between px-3 h-14 border-b border-[var(--cprot-border)] bg-[var(--cprot-bg)] z-20">
      {/* Esquerda: ☰ Menu e Marca ⚡ Copilot Protheus */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className="copilot-chat-header-btn p-1.5 rounded-lg text-[var(--cprot-text-sub)] hover:text-[var(--cprot-text-main)] hover:bg-[var(--cprot-surface-hover)] transition-colors cursor-pointer"
          title="Histórico e configurações"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/15 text-blue-500 font-bold text-xs select-none">
            ⚡
          </div>
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

      {/* Direita: ✕ Fechar painel */}
      <div>
        <button
          type="button"
          onClick={handleClose}
          className="copilot-chat-header-btn p-1.5 rounded-lg text-[var(--cprot-text-sub)] hover:text-red-400 hover:bg-[var(--cprot-surface-hover)] transition-colors cursor-pointer"
          title="Fechar painel"
          aria-label="Fechar painel"
        >
          <X size={18} />
        </button>
      </div>
    </header>
  );
}

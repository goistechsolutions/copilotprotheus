import React from 'react';
import { Menu, X } from 'lucide-react';

export function CopilotHeader({ onToggleMenu, onClose, isConnected = true }) {
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
    <header className="flex h-14 shrink-0 items-center justify-between px-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] z-20 select-none">
      {/* Esquerda: ☰ Menu e ⚡ Copilot Protheus */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleMenu}
          className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Histórico e configurações"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/15 text-blue-500 font-bold text-xs select-none">
            ⚡
          </div>
          <span className="font-semibold text-sm text-[var(--color-text)]">
            Copilot Protheus
          </span>
          {isConnected && (
            <span 
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" 
              title="Oracle Online"
            />
          )}
        </div>
      </div>

      {/* Direita: ✕ Fechar painel */}
      <div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Fechar painel"
          aria-label="Fechar painel"
        >
          <X size={18} />
        </button>
      </div>
    </header>
  );
}

export default CopilotHeader;

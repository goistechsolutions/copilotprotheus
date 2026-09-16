import React from 'react';
import { SparklesIcon, MoreVerticalIcon, CloseIcon } from './icons';

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
    }
  };

  return (
    <header className="copilot-chat-header">
      {/* Indicador de Conexão + Nome Minimal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span 
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isConnected ? 'var(--cprot-success)' : 'var(--cprot-text-muted)',
            boxShadow: isConnected ? '0 0 6px var(--cprot-success)' : 'none',
          }}
          title={isConnected ? 'Oracle Conectado' : 'Desconectado'}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '15px', color: 'var(--cprot-text-main)' }}>
          <SparklesIcon size={15} className="text-primary" />
          <span>Copilot Protheus</span>
        </div>
      </div>

      {/* Menu Secundário e Fechar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={onOpenMenu}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--cprot-text-sub)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Menu Secundário"
          aria-label="Abrir menu secundário"
        >
          <MoreVerticalIcon size={17} />
        </button>

        <button
          type="button"
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--cprot-text-sub)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Fechar Copilot"
          aria-label="Fechar Copilot"
        >
          <CloseIcon size={17} />
        </button>
      </div>
    </header>
  );
}

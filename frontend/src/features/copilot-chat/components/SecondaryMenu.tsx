import React, { useEffect, useRef } from 'react';
import { PlusIcon, HistoryIcon, SettingsIcon } from './icons';

interface SecondaryMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export function SecondaryMenu({
  isOpen,
  onClose,
  onNewConversation,
  onOpenHistory,
  onOpenSettings,
}: SecondaryMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: '52px',
        right: '16px',
        width: '200px',
        backgroundColor: 'var(--cprot-surface)',
        border: '1px solid var(--cprot-border)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        zIndex: 50,
      }}
      className="animate-fade-in"
      role="menu"
      aria-label="Menu secundário"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onNewConversation();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderRadius: '10px',
          color: 'var(--cprot-text-main)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          transition: 'background-color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cprot-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <PlusIcon size={15} />
        <span>Nova conversa</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenHistory();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderRadius: '10px',
          color: 'var(--cprot-text-main)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          transition: 'background-color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cprot-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <HistoryIcon size={15} />
        <span>Histórico</span>
      </button>

      <div style={{ height: '1px', backgroundColor: 'var(--cprot-border)', margin: '4px 0' }} />

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderRadius: '10px',
          color: 'var(--cprot-text-sub)',
          fontSize: '13px',
          fontWeight: 400,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          transition: 'background-color 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cprot-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <SettingsIcon size={15} />
        <span>Configurações</span>
      </button>
    </div>
  );
}

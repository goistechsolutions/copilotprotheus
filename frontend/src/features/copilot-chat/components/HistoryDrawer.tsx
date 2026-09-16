import React, { useEffect, useState } from 'react';
import { ConversationItem, CopilotSessionContext } from '../types/chat.types';
import { fetchConversationList } from '../services/copilotChatApi';
import { CloseIcon, PlusIcon, HistoryIcon } from './icons';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  context?: CopilotSessionContext;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  context,
}: HistoryDrawerProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchConversationList(context)
        .then((data) => setConversations(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen, context]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Backdrop transparente / desfoque suave */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 60,
          animation: 'fadeIn 0.2s forwards',
        }}
      />

      {/* Drawer Deslizante */}
      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '85%',
          backgroundColor: 'var(--cprot-surface)',
          borderLeft: '1px solid var(--cprot-border)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 70,
          animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Histórico de conversas"
      >
        {/* Header do Drawer */}
        <div style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--cprot-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--cprot-text-main)' }}>
            <HistoryIcon size={16} />
            <span>Histórico</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cprot-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Fechar Histórico"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Botão + Nova Conversa dentro do Drawer */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cprot-border)' }}>
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              backgroundColor: 'var(--cprot-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <PlusIcon size={14} />
            <span>Nova conversa</span>
          </button>
        </div>

        {/* Lista de Conversas */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: 'var(--cprot-text-muted)' }}>
              Carregando histórico...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: '13px', color: 'var(--cprot-text-muted)' }}>
              Nenhuma conversa anterior encontrada.
            </div>
          ) : (
            conversations.map((item) => {
              const isSelected = item.id === currentConversationId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectConversation(item.id);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: isSelected ? 'var(--cprot-primary-light)' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--cprot-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'var(--cprot-primary)' : 'var(--cprot-text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                  }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--cprot-text-muted)' }}>
                    {formatDate(item.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

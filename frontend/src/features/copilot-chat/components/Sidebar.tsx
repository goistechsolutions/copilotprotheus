import React, { useEffect, useState, useMemo } from 'react';
import { ConversationItem, CopilotSessionContext } from '../types/chat.types';
import { fetchConversationList } from '../services/copilotChatApi';
import { PlusIcon } from './icons';

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  context?: CopilotSessionContext;
}

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  context,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    fetchConversationList(context)
      .then((data) => setConversations(data))
      .finally(() => setLoading(false));
  }, [context]);

  // Agrupamento simulado para 'Hoje' e 'Últimos 7 dias' baseados na data
  const groups = useMemo(() => {
    const today: ConversationItem[] = [];
    const last7Days: ConversationItem[] = [];
    
    const now = new Date();
    conversations.forEach(item => {
      const d = new Date(item.createdAt);
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        today.push(item);
      } else if (diffDays <= 7) {
        last7Days.push(item);
      } else {
        last7Days.push(item); // Fallback para exibir todos no histórico
      }
    });

    return { today, last7Days };
  }, [conversations]);

  return (
    <aside
      className="copilot-sidebar"
      style={{
        width: '260px',
        flexShrink: 0,
        backgroundColor: 'var(--cprot-bg)',
        borderRight: '1px solid var(--cprot-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onNewConversation}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          backgroundColor: 'transparent',
          border: '1px solid var(--cprot-border)',
          color: 'var(--cprot-text-main)',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '24px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--cprot-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <PlusIcon size={16} />
        <span>Nova Conversa</span>
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Favoritos Simulados */}
        <div>
          <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cprot-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '8px' }}>
            Favoritos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <SidebarItem icon="⭐" title="Fluxo Caixa" onClick={() => {}} />
            <SidebarItem icon="⭐" title="Recebíveis" onClick={() => {}} />
          </div>
        </div>

        {groups.today.length > 0 && (
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cprot-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '8px' }}>
              Hoje
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {groups.today.map(item => (
                <SidebarItem 
                  key={item.id}
                  icon="💬"
                  title={item.title || 'Conversa'}
                  isActive={currentConversationId === item.id}
                  onClick={() => onSelectConversation(item.id)} 
                />
              ))}
            </div>
          </div>
        )}

        {groups.last7Days.length > 0 && (
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cprot-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '8px' }}>
              Últimos 7 dias
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {groups.last7Days.map(item => (
                <SidebarItem 
                  key={item.id}
                  icon="💬"
                  title={item.title || 'Conversa'}
                  isActive={currentConversationId === item.id}
                  onClick={() => onSelectConversation(item.id)} 
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
}

function SidebarItem({ icon, title, isActive = false, onClick }: { icon: string, title: string, isActive?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '8px',
        backgroundColor: isActive ? 'var(--cprot-surface)' : 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: isActive ? 'var(--cprot-text-main)' : 'var(--cprot-text-sub)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{ fontSize: '14px', filter: isActive ? 'grayscale(0)' : 'grayscale(1)', opacity: isActive ? 1 : 0.6 }}>{icon}</span>
      <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </span>
    </button>
  );
}

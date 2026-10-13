import React, { useState, useEffect } from 'react';
import ChatView from '../chat/ChatView';
import DashboardView from '../dashboard/DashboardView';
import { useDashboardStore } from '../../../stores/useDashboardStore';

/**
 * CopilotPanel — Container lateral do Copilot Protheus
 * Renderiza EXCLUSIVAMENTE o estado ativo:
 * - ESTADO 1: CHAT (Conversa natural, sem KPIs nem gráficos soltos no chat)
 * - ESTADO 2: DASHBOARD (Exploração sob demanda: Indicadores + Gráficos + Filtros + Detalhes)
 */
export default function CopilotPanel({ context, onClose }) {
  const { currentDashboard, setDashboard, session } = useDashboardStore();
  const [view, setView] = useState('chat'); // 'chat' | 'dashboard'
  const [activeDashboard, setActiveDashboard] = useState(null);

  // Sincroniza se vier evento externo de abertura de dashboard
  useEffect(() => {
    if (currentDashboard) {
      setActiveDashboard(currentDashboard);
      setView('dashboard');
    }
  }, [currentDashboard]);

  const handleOpenDashboard = (dash) => {
    setActiveDashboard(dash);
    setDashboard(dash);
    setView('dashboard');
  };

  const handleBackToChat = () => {
    setView('chat');
    setDashboard(null);
  };

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
    <aside className="copilot-panel w-full h-full bg-[var(--color-bg)] flex flex-col overflow-hidden font-sans select-text">
      {view === 'chat' ? (
        <ChatView
          context={context || session}
          onOpenDashboard={handleOpenDashboard}
          onClose={handleClose}
        />
      ) : (
        <DashboardView
          dashboard={activeDashboard || currentDashboard}
          onBackToChat={handleBackToChat}
          onClose={handleClose}
        />
      )}
    </aside>
  );
}

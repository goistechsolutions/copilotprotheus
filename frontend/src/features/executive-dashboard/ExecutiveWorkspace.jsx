import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotChat } from '../copilot-chat';
import { CompactDashboardPanel } from '../copilot-chat/components/CompactDashboardPanel';

/**
 * ExecutiveWorkspace — Painel Lateral Fixo do Copilot Protheus
 * Gerencia os 2 estados exclusivos no mesmo painel lateral:
 * 1. CHAT (Padrão: Conversação + [Abrir dashboard])
 * 2. DASHBOARD (Troca de contexto sob demanda: Indicadores + Gráfico + Filtros + Detalhes + [Voltar])
 */
export default function ExecutiveWorkspace() {
  const { 
    currentDashboard, 
    setDashboard, 
    config, 
    session,
  } = useDashboardStore();

  useEffect(() => {
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', config.theme);
  }, [config.theme]);

  // Escuta evento global de integração 'copilot:open-dashboard'
  useEffect(() => {
    const handleOpenDashboardEvent = (event) => {
      const detail = event?.detail;
      if (detail?.dashboard) {
        setDashboard(detail.dashboard);
      }
    };
    window.addEventListener('copilot:open-dashboard', handleOpenDashboardEvent);
    return () => window.removeEventListener('copilot:open-dashboard', handleOpenDashboardEvent);
  }, [setDashboard]);

  const handleClosePanel = () => {
    window.dispatchEvent(new CustomEvent('copilot:close'));
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-close' }, '*');
    }
  };

  const isDashboardActive = Boolean(currentDashboard);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[var(--cprot-bg)] text-[var(--cprot-text-main)] transition-colors">
      <AnimatePresence mode="wait">
        {isDashboardActive ? (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <CompactDashboardPanel
              dashboard={currentDashboard}
              onBackToChat={() => setDashboard(null)}
              onClosePanel={handleClosePanel}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat-view"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <CopilotChat
              context={session}
              onOpenDashboard={(dash) => setDashboard(dash)}
              onClose={handleClosePanel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

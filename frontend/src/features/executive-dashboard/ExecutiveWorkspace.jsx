import React, { useEffect } from 'react';
import CopilotPanel from '../../components/copilot/common/CopilotPanel';
import { useDashboardStore } from '../../stores/useDashboardStore';

/**
 * ExecutiveWorkspace — Ponto de Entrada da Interface do Copilot
 * Renderiza o CopilotPanel (Design System 2 Estados: CHAT vs DASHBOARD)
 */
export default function ExecutiveWorkspace() {
  const { config, session } = useDashboardStore();

  useEffect(() => {
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', config.theme);
  }, [config.theme]);

  const handleClosePanel = () => {
    window.dispatchEvent(new CustomEvent('copilot:close'));
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-close' }, '*');
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
      <CopilotPanel 
        context={session} 
        onClose={handleClosePanel} 
      />
    </div>
  );
}

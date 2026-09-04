import React, { useState, useEffect } from 'react';
import AgentWorkspace from './pages/AgentWorkspace';
import ExecutiveDashboard from './pages/ExecutiveDashboard';

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      if (pageParam === 'dashboard' || pageParam === 'executivo') return 'dashboard';
    } catch {}
    return 'workspace';
  });

  const [selectedArea, setSelectedArea] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('area') || 'financeiro';
    } catch {
      return 'financeiro';
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      const areaParam = urlParams.get('area');
      if (areaParam) setSelectedArea(areaParam);
      if (pageParam === 'dashboard' || pageParam === 'executivo') {
        setCurrentPage('dashboard');
        try {
          window.parent.postMessage({ type: 'cprot-result-state', open: true }, '*');
        } catch {}
      } else {
        setCurrentPage('workspace');
        try {
          window.parent.postMessage({ type: 'cprot-result-state', open: false }, '*');
        } catch {}
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [dashboardData, setDashboardData] = useState(null);

  const navigateToDashboard = (targetArea, data = null) => {
    const area = targetArea || 'financeiro';
    setSelectedArea(area);
    if (data) setDashboardData(data);
    setCurrentPage('dashboard');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'dashboard');
      url.searchParams.set('area', area);
      window.history.pushState({}, '', url.toString());
      // Notifica o content-script da extensão para expandir a janela para visualização completa
      window.parent.postMessage({ type: 'cprot-result-state', open: true }, '*');
    } catch {}
  };

  const navigateToWorkspace = () => {
    setCurrentPage('workspace');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      url.searchParams.delete('area');
      window.history.pushState({}, '', url.toString());
      // Notifica o content-script da extensão para recolher para o tamanho padrão de chat
      window.parent.postMessage({ type: 'cprot-result-state', open: false }, '*');
    } catch {}
  };

  const [context, setContext] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        tenant_id: urlParams.get('tenantId') || urlParams.get('tenant_id') || '',
        company: urlParams.get('company') || '',
        branch: urlParams.get('branch') || '',
        user: urlParams.get('user') || '',
        environment: urlParams.get('environment') || '',
        module: urlParams.get('module') || '',
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event?.data || !['PROTHEUS_CONTEXT', 'cprot-context-update', 'cprot-config'].includes(event.data.type)) return;
      const incoming = event.data.payload || event.data.context || {};
      setContext((prev) => ({
        ...prev,
        tenant_id: incoming.tenant_id || event.data.tenantId || prev.tenant_id,
        company: incoming.company_code || incoming.company || prev.company,
        branch: incoming.branch || prev.branch,
        user: incoming.user || prev.user,
        environment: incoming.environment_code || incoming.environment || prev.environment,
        module: incoming.module || prev.module,
      }));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (currentPage === 'dashboard') {
    return (
      <ExecutiveDashboard
        initialArea={selectedArea}
        onNavigateToWorkspace={navigateToWorkspace}
        context={context}
        initialData={dashboardData}
      />
    );
  }

  return <AgentWorkspace onNavigateToDashboard={navigateToDashboard} externalContext={context} />;
}

import React, { useState, useEffect, useRef } from 'react';
import AgentWorkspace from './pages/AgentWorkspace';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import AuthGate from './components/AuthGate';

const TRUSTED_PARENT_SUFFIXES = [
  '.protheus.cloudtotvs.com.br',
  '.cloudtotvs.com.br',
  '.totvs.com.br',
  'localhost',
];

function isTrustedParentOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    
    // Bypass para localhost em dev (se VITE_DEV_BYPASS_AUTH)
    if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true' && host === 'localhost') return true;
    
    if (url.protocol !== 'https:') return false;
    return TRUSTED_PARENT_SUFFIXES.some((suffix) => host.endsWith(suffix) || host === suffix);
  } catch {
    return false;
  }
}

export default function App() {
  const trustedParentOriginRef = useRef(null);

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
        notifyLayoutChange(true);
      } else {
        setCurrentPage('workspace');
        notifyLayoutChange(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [dashboardData, setDashboardData] = useState(null);

  const notifyLayoutChange = (open) => {
    if (window.parent !== window && trustedParentOriginRef.current) {
      try {
        window.parent.postMessage({ type: 'cprot-result-state', open }, trustedParentOriginRef.current);
      } catch {}
    }
  };

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
      notifyLayoutChange(true);
    } catch {}
  };

  const navigateToWorkspace = () => {
    setCurrentPage('workspace');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      url.searchParams.delete('area');
      window.history.pushState({}, '', url.toString());
      notifyLayoutChange(false);
    } catch {}
  };

  const [context, setContext] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        tenant_id: '',
        company: urlParams.get('company') || '',
        branch: urlParams.get('branch') || '',
        user: '',
        environment: urlParams.get('environment') || '',
        module: urlParams.get('module') || '',
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (window.parent !== window && event.source !== window.parent) return;
      if (!isTrustedParentOrigin(event.origin) && import.meta.env.VITE_ALLOW_LOCAL_POSTMESSAGE !== 'true') return;
      
      if (!trustedParentOriginRef.current) {
        trustedParentOriginRef.current = event.origin;
      }

      if (!event?.data || !['PROTHEUS_CONTEXT', 'cprot-context-update', 'cprot-config'].includes(event.data.type)) return;
      
      const incoming = event.data.payload || event.data.context || {};
      
      setContext((prev) => {
        const newCompany = incoming.company_code || incoming.company;
        const newBranch = incoming.branch;
        const newEnvironment = incoming.environment_code || incoming.environment;
        const newModule = incoming.module;
        
        return {
          ...prev,
          company: newCompany !== undefined ? newCompany : prev.company,
          branch: newBranch !== undefined ? newBranch : prev.branch,
          environment: newEnvironment !== undefined ? newEnvironment : prev.environment,
          module: newModule !== undefined ? newModule : prev.module,
        };
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAuthContext = (authData) => {
    setContext(prev => ({
      ...prev,
      tenant_id: authData.tenant_id,
      user: authData.user_id,
      role: authData.role
    }));
  };

  const renderContent = () => {
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
  };

  return (
    <AuthGate onContextAvailable={handleAuthContext}>
      {renderContent()}
    </AuthGate>
  );
}

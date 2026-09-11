import React, { useEffect, useRef } from 'react';
import ExecutiveWorkspace from './features/executive-dashboard/ExecutiveWorkspace';
import AuthGate from './components/AuthGate';
import { useDashboardStore } from './stores/useDashboardStore';

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
  const { setSession, chat } = useDashboardStore();

  // Sempre notifica o parent sobre expansão/recolhimento baseado na sidebar
  // Mantemos isso para caso a extensão precise expandir a tela do TOTVS quando fecha a sidebar
  useEffect(() => {
    if (window.parent !== window && trustedParentOriginRef.current) {
      try {
        window.parent.postMessage({ type: 'cprot-result-state', open: !chat.isOpen }, trustedParentOriginRef.current);
      } catch {}
    }
  }, [chat.isOpen]);

  useEffect(() => {
    // Config inicial via URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      setSession({
        company: urlParams.get('company') || '',
        branch: urlParams.get('branch') || '',
        environment: urlParams.get('environment') || '',
        module: urlParams.get('module') || '',
      });
    } catch {}

    const handleMessage = (event) => {
      if (window.parent !== window && event.source !== window.parent) return;
      if (!isTrustedParentOrigin(event.origin) && import.meta.env.VITE_ALLOW_LOCAL_POSTMESSAGE !== 'true') return;
      
      if (!trustedParentOriginRef.current) {
        trustedParentOriginRef.current = event.origin;
      }

      if (!event?.data || !['PROTHEUS_CONTEXT', 'cprot-context-update', 'cprot-config'].includes(event.data.type)) return;
      
      const incoming = event.data.payload || event.data.context || {};
      
      const newCompany = incoming.company_code || incoming.company;
      const newBranch = incoming.branch;
      const newEnvironment = incoming.environment_code || incoming.environment;
      const newModule = incoming.module;
      
      setSession({
        company: newCompany,
        branch: newBranch,
        environment: newEnvironment,
        module: newModule,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setSession]);

  const handleAuthContext = (authData) => {
    setSession({
      tenantId: authData.tenant_id,
      userId: authData.user_id,
      role: authData.role,
      isAuthenticated: true
    });
  };

  return (
    <AuthGate onContextAvailable={handleAuthContext}>
      {/* 
        Frontend Enterprise v3.0 
        Substitui o antigo roteamento por uma única plataforma combinada.
      */}
      <ExecutiveWorkspace />
    </AuthGate>
  );
}

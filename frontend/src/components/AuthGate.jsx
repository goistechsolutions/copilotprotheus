import React, { useEffect, useState } from 'react';
import { apiGetAuthMe } from '../services/api';

export default function AuthGate({ children, onContextAvailable }) {
  const [authState, setAuthState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await apiGetAuthMe();
        if (data && data.authenticated) {
          setAuthState({ status: 'authenticated', user: data });
          if (onContextAvailable) {
            onContextAvailable({
              tenant_id: data.tenant_id,
              user_id: data.user_id,
              role: data.role
            });
          }
        } else {
          setAuthState({ status: 'error', user: null });
        }
      } catch (err) {
        setAuthState({ status: 'error', user: null });
      }
    }
    checkAuth();
  }, []);

  if (authState.status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
        <div style={{color: '#64748b'}}>Carregando acesso...</div>
      </div>
    );
  }

  if (authState.status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', padding: '20px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '8px', color: '#171c20' }}>Acesso indisponível</h3>
        <p style={{ color: '#64748b' }}>Faça login no Copilot Protheus para continuar.<br/>O acesso a consultas e resultados depende de uma sessão corporativa válida.</p>
      </div>
    );
  }

  return <>{children}</>;
}

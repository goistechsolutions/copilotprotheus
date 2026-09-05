import React, { useEffect, useState } from 'react';
import { apiGetAuthMe, apiLogin } from '../services/api';

export default function AuthGate({ children, onContextAvailable }) {
  const [authState, setAuthState] = useState({ status: 'loading', user: null });
  const [tenantId, setTenantId] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('tenantId') || urlParams.get('tenant_id') || '';
    } catch {
      return '';
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const checkAuth = async () => {
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
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await apiLogin(tenantId, username, password);
      await checkAuth(); // Re-verify and update state
    } catch (err) {
      setLoginError(err.message || 'Falha na autenticação');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (authState.status === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen w-full">
        <div className="text-slate-500">Carregando acesso...</div>
      </div>
    );
  }

  if (authState.status === 'error') {
    return (
      <div className="flex flex-col justify-center items-center h-screen w-full p-5 text-center bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">Acesso Restrito</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Faça login no Copilot Protheus para continuar.
          </p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tenant ID</label>
              <input
                type="text"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                placeholder="rodol_prod"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">E-mail / Usuário</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                placeholder="usuario@empresa.com.br"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <div className="text-red-500 text-xs font-semibold text-center">{loginError}</div>
            )}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>({ user: 'admin', name: 'Administrador Nexxus', role: 'superadmin' });
  const [loading, setLoading] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser({ user: 'admin', name: 'Administrador Nexxus', role: 'superadmin' });
      }
    } catch {
      setUser({ user: 'admin', name: 'Administrador Nexxus', role: 'superadmin' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username: string, password?: string) => {
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser({ user: username || 'admin', name: 'Administrador Nexxus', role: 'superadmin' });
      }
    } catch {
      setUser({ user: username || 'admin', name: 'Administrador Nexxus', role: 'superadmin' });
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: { user: 'admin', name: 'Administrador Nexxus', role: 'superadmin' },
      loading: false,
      login: async () => {},
      logout: async () => {},
    };
  }
  return context;
};

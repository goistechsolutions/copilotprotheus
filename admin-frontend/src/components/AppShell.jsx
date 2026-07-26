import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Building2, Users, BookOpen,
  ScrollText, Server, Plug, ChevronLeft, ChevronRight,
  LogOut, Bell, Settings, Menu
} from 'lucide-react';

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',              end: true },
  { to: '/tenants',      icon: Building2,       label: 'Tenants & Empresas' },
  { to: '/users',        icon: Users,           label: 'Usuários & Permissões' },
  { to: '/knowledge',    icon: BookOpen,        label: 'Base de Conhecimento' },
  { to: '/logs',         icon: ScrollText,      label: 'Logs & Auditoria' },
  { to: '/platform',     icon: Server,          label: 'Plataforma' },
  { to: '/integrations', icon: Plug,            label: 'Integrações' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-[#161B27] border-r border-[#1E2535] transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-[#1E2535] ${
          collapsed ? 'justify-center' : ''
        }`}>
          <div className="w-8 h-8 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-lg flex items-center justify-center shrink-0 shadow-md shadow-[#1565C0]/30">
            <span className="text-white font-black text-sm">E</span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-bold text-sm tracking-tight">
                ELITE<span className="text-[#2196F3]">CORP</span>
              </div>
              <div className="text-[#8892A4] text-[10px]">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-[#1565C0]/20 text-[#2196F3] border border-[#1565C0]/30'
                    : 'text-[#8892A4] hover:bg-[#1E2535] hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className={`p-3 border-t border-[#1E2535] ${
          collapsed ? 'flex justify-center' : ''
        }`}>
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{user?.user?.[0]?.toUpperCase() || 'A'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{user?.user || 'Admin'}</div>
                <div className="text-[#8892A4] text-[10px]">Administrador</div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-[#161B27] border border-[#1E2535] rounded-full flex items-center justify-center text-[#8892A4] hover:text-white hover:border-[#2196F3] transition-all z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-[#161B27] border-b border-[#1E2535] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-[#8892A4] hover:text-white"
              onClick={() => setCollapsed(c => !c)}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-[#1E2535] mx-1" />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-medium transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

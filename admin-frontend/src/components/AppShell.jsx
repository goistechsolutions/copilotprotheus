import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Building2, Users, BookOpen, ScrollText,
  Server, Plug, Shield, Database, Key, FileSearch,
  Activity, Settings, ChevronLeft, ChevronRight,
  LogOut, Bell, Menu, ShieldCheck, Table2, Lock
} from 'lucide-react';

const navSections = [
  {
    label: 'Principal',
    items: [
      { to: '/',            icon: LayoutDashboard, label: 'Dashboard',           end: true },
    ]
  },
  {
    label: 'Clientes',
    items: [
      { to: '/tenants',     icon: Building2,       label: 'Tenants' },
      { to: '/companies',   icon: Building2,       label: 'Empresas' },
    ]
  },
  {
    label: 'Acesso',
    items: [
      { to: '/users',       icon: Users,           label: 'Usuários' },
      { to: '/roles',       icon: Shield,          label: 'Perfis & Perm.' },
    ]
  },
  {
    label: 'Conhecimento',
    items: [
      { to: '/knowledge',   icon: BookOpen,        label: 'Base RAG' },
    ]
  },
  {
    label: 'Catálogo Protheus',
    items: [
      { to: '/dictionary',  icon: Database,        label: 'Sincronização' },
      { to: '/snapshots',   icon: FileSearch,      label: 'Snapshots' },
      { to: '/tables',      icon: Table2,          label: 'Tabelas & Campos' },
      { to: '/permissions', icon: Lock,            label: 'Permissões' },
      { to: '/query-guard', icon: ShieldCheck,     label: 'Query Guard' },
    ]
  },
  {
    label: 'Monitoramento',
    items: [
      { to: '/logs',        icon: ScrollText,      label: 'Logs' },
      { to: '/audit',       icon: Activity,        label: 'Auditoria' },
    ]
  },
  {
    label: 'Plataforma',
    items: [
      { to: '/platform',    icon: Server,          label: 'Infra & Saúde' },
      { to: '/config',      icon: Settings,        label: 'Configurações' },
      { to: '/licenses',    icon: Key,             label: 'Licenças' },
      { to: '/integrations',icon: Plug,            label: 'Integrações' },
      { to: '/adminer',     icon: Database,        label: 'DB Admin' },
    ]
  },
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
      <aside className={`relative flex flex-col bg-[#161B27] border-r border-[#1E2535] transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-[#1E2535] shrink-0 ${
          collapsed ? 'justify-center' : ''
        }`}>
          <div className="w-8 h-8 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-lg flex items-center justify-center shrink-0 shadow-md shadow-[#1565C0]/30">
            <span className="text-white font-black text-sm">E</span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-bold text-sm tracking-tight">ELITE<span className="text-[#2196F3]">CORP</span></div>
              <div className="text-[#8892A4] text-[10px]">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
          {navSections.map(section => (
            <div key={section.label}>
              {!collapsed && (
                <div className="text-[#8892A4]/60 text-[10px] font-semibold uppercase tracking-widest px-3 mb-1">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
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
              </div>
            </div>
          ))}
        </nav>

        {/* User / Logout */}
        <div className={`p-3 border-t border-[#1E2535] shrink-0 ${
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
              <button onClick={handleLogout} disabled={loggingOut}
                className="p-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                title="Encerrar sessão">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-2 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
              title="Encerrar sessão">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-[#161B27] border border-[#1E2535] rounded-full flex items-center justify-center text-[#8892A4] hover:text-white hover:border-[#2196F3] transition-all z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-[#161B27] border-b border-[#1E2535] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-[#8892A4] hover:text-white" onClick={() => setCollapsed(c => !c)}>
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
            <button onClick={handleLogout} disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-medium transition-all">
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

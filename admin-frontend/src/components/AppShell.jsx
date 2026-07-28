import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Building2, Users, BookOpen, ScrollText,
  Server, Plug, Key, Database, ShieldCheck,
  Activity, Settings, ChevronLeft, ChevronRight,
  LogOut, Bell, Menu, Table2, Lock, FileSearch, RefreshCw
} from 'lucide-react';

const nav = [
  { section: 'Principal', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  ]},
  { section: 'Clientes', items: [
    { to: '/tenants',   icon: Building2, label: 'Tenants' },
    { to: '/companies', icon: Building2, label: 'Empresas' },
  ]},
  { section: 'Acesso', items: [
    { to: '/users', icon: Users,  label: 'Usuários' },
    { to: '/roles', icon: Lock,   label: 'Perfis & Perm.' },
  ]},
  { section: 'Base de Conhecimento', items: [
    { to: '/knowledge', icon: BookOpen, label: 'Memórias RAG' },
  ]},
  { section: 'Catálogo Protheus', items: [
    { to: '/dictionary',  icon: RefreshCw,   label: 'Sincronizar Dicionário' },
    { to: '/snapshots',   icon: FileSearch,  label: 'Snapshots' },
    { to: '/tables',      icon: Table2,      label: 'Tabelas & Campos' },
    { to: '/permissions', icon: ShieldCheck, label: 'Permissões' },
    { to: '/query-guard', icon: Database,    label: 'Query Guard' },
  ]},
  { section: 'Monitoramento', items: [
    { to: '/logs',  icon: ScrollText, label: 'Logs' },
    { to: '/audit', icon: Activity,   label: 'Auditoria de Uso' },
  ]},
  { section: 'Plataforma', items: [
    { to: '/platform',     icon: Server,   label: 'Infra & Saúde' },
    { to: '/integrations', icon: Plug,     label: 'Integrações' },
    { to: '/config',       icon: Settings, label: 'Configurações' },
    { to: '/licenses',     icon: Key,      label: 'Licenças' },
    { to: '/adminer',      icon: Database, label: 'DB Admin' },
  ]},
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

      {/* ── Sidebar ── */}
      <aside className={`relative flex flex-col bg-[#161B27] border-r border-[#1E2535] transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-14 border-b border-[#1E2535] shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-lg flex items-center justify-center shrink-0 shadow-md shadow-[#1565C0]/30">
            <span className="text-white font-black text-xs">E</span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-bold text-sm">ELITE<span className="text-[#2196F3]">CORP</span></div>
              <div className="text-[#8892A4] text-[10px] leading-none">Copilot Protheus</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-3">
          {nav.map(({ section, items }) => (
            <div key={section}>
              {!collapsed && (
                <div className="text-[#8892A4]/50 text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1">
                  {section}
                </div>
              )}
              {items.map(({ to, icon: Icon, label, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#1565C0]/20 text-[#60A5FA] border border-[#1565C0]/30'
                        : 'text-[#8892A4] hover:bg-[#1E2535] hover:text-[#CBD5E1]'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className={`p-2.5 border-t border-[#1E2535] shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">{user?.user?.[0]?.toUpperCase() || 'A'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{user?.user || 'Admin'}</div>
                <div className="text-[#8892A4] text-[10px]">Administrador</div>
              </div>
              <button onClick={handleLogout} disabled={loggingOut}
                className="p-1 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                title="Sair">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-2 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-16 w-6 h-6 bg-[#161B27] border border-[#1E2535] rounded-full flex items-center justify-center text-[#8892A4] hover:text-white hover:border-[#2196F3] transition-all z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[#161B27] border-b border-[#1E2535] flex items-center justify-between px-5 shrink-0">
          <button className="lg:hidden p-1.5 text-[#8892A4] hover:text-white" onClick={() => setCollapsed(c => !c)}>
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            <button className="p-1.5 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-[#1E2535] mx-1" />
            <button onClick={handleLogout} disabled={loggingOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-medium transition-all">
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

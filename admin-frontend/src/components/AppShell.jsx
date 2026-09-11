import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileSearch,
  Gauge,
  HeartPulse,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  PlugZap,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const nav = [
  {
    section: 'Visão geral',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', description: 'Saúde e indicadores', end: true },
    ],
  },
  {
    section: 'Estrutura corporativa',
    items: [
      { to: '/tenants', icon: Building2, label: 'Tenants', description: 'Clientes e ambientes' },
      { to: '/companies', icon: Building2, label: 'Empresas', description: 'Empresas e filiais' },
    ],
  },
  {
    section: 'Identidade e acesso',
    items: [
      { to: '/users', icon: Users, label: 'Usuários', description: 'Contas autorizadas' },
      { to: '/roles', icon: ShieldCheck, label: 'Perfis e permissões', description: 'RBAC administrativo' },
    ],
  },
  {
    section: 'Governança Protheus',
    items: [
      { to: '/tables', icon: Database, label: 'Tabelas e Campos', description: 'Catálogo SX2/SX3' },
      { to: '/dictionary', icon: SlidersHorizontal, label: 'Sincronização', description: 'Dicionário autorizado' },
      { to: '/governance/domains', icon: Layers, label: 'Domínios ERP', description: 'Mapeamento de macro-domínios' },
      { to: '/governance/intents', icon: Sparkles, label: 'Intents', description: 'Intenções de negócio e tabelas' },
      { to: '/governance/semantic-dictionary', icon: BookMarked, label: 'Dicionário Semântico', description: 'Aliases e termos de negócio' },
      { to: '/governance/metrics', icon: Calculator, label: 'Métricas', description: 'Fórmulas e KPIs governados' },
      { to: '/governance/dashboards', icon: LayoutGrid, label: 'Dashboards', description: 'Templates por intenção' },
      { to: '/governance/business-rules', icon: Scale, label: 'Regras de Negócio', description: 'Filtros mandatórios e restrições' },
      { to: '/governance/health', icon: HeartPulse, label: 'Saúde do Conhecimento', description: 'Auditoria e diagnóstico' },
    ],
  },
  {
    section: 'Conhecimento',
    items: [
      { to: '/knowledge', icon: BookOpen, label: 'Memórias RAG', description: 'Base de conhecimento' },
    ],
  },
  {
    section: 'Operação',
    items: [
      { to: '/logs', icon: Activity, label: 'Logs', description: 'Eventos técnicos' },
      { to: '/audit', icon: FileSearch, label: 'Auditoria de uso', description: 'Consultas e ações' },
      { to: '/platform', icon: Gauge, label: 'Infraestrutura', description: 'Saúde dos serviços' },
    ],
  },
  {
    section: 'Plataforma',
    items: [
      { to: '/integrations', icon: PlugZap, label: 'Integrações', description: 'Conectores e REST' },
      { to: '/licenses', icon: KeyRound, label: 'Licenças', description: 'Planos e contratos' },
      { to: '/config', icon: Settings2, label: 'Configurações', description: 'Preferências seguras' },
      { to: '/adminer', icon: Database, label: 'DB Admin', description: 'Acesso operacional restrito' },
    ],
  },
];

const flattenedItems = nav.flatMap(group => group.items);

function initials(value) {
  const parts = String(value || 'Admin').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'AD';
}

function Sidebar({ collapsed, mobileOpen, onClose, onToggle, user, onLogout, loggingOut, search, onSearch }) {
  const visibleGroups = nav
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const query = search.trim().toLowerCase();
        return !query || `${item.label} ${item.description}`.toLowerCase().includes(query);
      }),
    }))
    .filter(group => group.items.length > 0);

  return (
    <>
      {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-slate-800/80 bg-[#0d1422] shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'lg:w-[82px]' : 'lg:w-[286px]'}`}>
        <div className={`flex h-[76px] shrink-0 items-center border-b border-slate-800/80 px-5 ${collapsed ? 'lg:justify-center lg:px-3' : 'justify-between'}`}>
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-sm font-black text-white shadow-lg shadow-blue-900/30">N</span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold tracking-tight text-white">NEXXUS <span className="font-medium text-cyan-300">Admin</span></span>
                <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Copilot Protheus</span>
              </span>
            )}
          </Link>
          <button aria-label="Fechar menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {!collapsed && (
          <div className="px-4 pb-3 pt-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar no painel" aria-label="Buscar no painel" className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10" />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-600 xl:block">⌘K</kbd>
            </label>
          </div>
        )}

        <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {visibleGroups.map(group => (
            <div key={group.section} className="mb-5">
              {!collapsed && <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{group.section}</div>}
              <div className="space-y-1">
                {group.items.map(({ to, icon: Icon, label, description, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={onClose} title={collapsed ? `${label} — ${description}` : undefined} className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-all ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${isActive ? 'bg-cyan-400/[0.09] text-cyan-200 shadow-[inset_3px_0_0_#22d3ee]' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}>
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && <span className="min-w-0"><span className="block truncate font-semibold">{label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-600 group-hover:text-slate-500">{description}</span></span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          {visibleGroups.length === 0 && !collapsed && <p className="px-3 py-6 text-xs leading-5 text-slate-500">Nenhuma área corresponde à busca.</p>}
        </nav>

        <div className={`shrink-0 border-t border-slate-800/80 p-3 ${collapsed ? 'lg:px-3' : ''}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-slate-950/40 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white">{initials(user?.user)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{user?.user || 'Administrador'}</p><p className="mt-0.5 text-[10px] text-slate-500">Acesso administrativo</p></div>
              <button aria-label="Sair" onClick={onLogout} disabled={loggingOut} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"><LogOut className="h-4 w-4" /></button>
            </div>
          ) : <button aria-label="Sair" onClick={onLogout} disabled={loggingOut} className="mx-auto flex rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"><LogOut className="h-4 w-4" /></button>}
        </div>
        <button aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={onToggle} className="absolute -right-3 top-[84px] hidden h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-[#111b2d] text-slate-400 shadow-lg transition hover:border-cyan-400/60 hover:text-cyan-200 lg:flex">{collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}</button>
      </aside>
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setSearch('');
  }, [location.pathname]);

  useEffect(() => {
    const handler = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('input[aria-label="Buscar no painel"]')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeItem = useMemo(() => flattenedItems.find(item => item.to !== '/' && location.pathname.startsWith(`/admin${item.to}`)) || flattenedItems.find(item => item.to === '/'), [location.pathname]);
  const section = nav.find(group => group.items.some(item => item.to === activeItem?.to))?.section || 'Administração';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="min-h-screen bg-[#09111e] text-slate-100 lg:flex">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToggle={() => setCollapsed(value => !value)} user={user} onLogout={handleLogout} loggingOut={loggingOut} search={search} onSearch={setSearch} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[76px] shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#09111e]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Abrir menu" className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5 text-slate-400 hover:border-slate-700 hover:text-white lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
            <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600"><span>Administração</span><span className="text-slate-700">/</span><span className="truncate text-cyan-400/80">{section}</span></div><h1 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">{activeItem?.label || 'Painel administrativo'}</h1></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-semibold text-emerald-300 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> Ambiente protegido</div>
            <Link to="/logs" aria-label="Abrir logs" className="rounded-xl border border-transparent p-2.5 text-slate-500 transition hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-200"><Bell className="h-[17px] w-[17px]" /></Link>
            <Link to="/config" aria-label="Abrir configurações" className="rounded-xl border border-transparent p-2.5 text-slate-500 transition hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-200"><Settings2 className="h-[17px] w-[17px]" /></Link>
            <div className="hidden h-7 w-px bg-slate-800 sm:block" />
            <div className="hidden items-center gap-2 sm:flex"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-[10px] font-bold text-white">{initials(user?.user)}</div><ChevronDown className="h-3.5 w-3.5 text-slate-600" /></div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-800/60 px-4 py-3 text-[10px] text-slate-600 sm:px-6 lg:px-8"><span>NEXXUS Admin · Copilot Protheus</span><span className="hidden items-center gap-1.5 sm:flex"><CircleHelp className="h-3.5 w-3.5" /> Operação somente leitura no ERP</span></footer>
      </div>
    </div>
  );
}

export { nav };

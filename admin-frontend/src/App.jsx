import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Database, LayoutDashboard, ShieldAlert, Building, Key, Brain, Cloud, UserCog, LogOut, Menu, Activity, Server, Sparkles, Cpu, Lock, Layers } from 'lucide-react';
import { useState } from 'react';

import Config from './pages/Config';
import AgentUsers from './pages/AgentUsers';
import AgentRoles from './pages/AgentRoles';
import Tables from './pages/Tables';
import Logs from './pages/Logs';
import Companies from './pages/Companies';
import Tenants from './pages/Tenants';
import Licenses from './pages/Licenses';
import RagMemories from './pages/RagMemories';
import Adminer from './pages/Adminer';
import Infra from './pages/Infra';
import CompanyDashboard from './pages/CompanyDashboard';

import DictionarySyncPage from './pages/DictionarySyncPage';
import SnapshotsPage from './pages/SnapshotsPage';
import PermissionEditorPage from './pages/PermissionEditorPage';
import QueryGuardPage from './pages/QueryGuardPage';
import AuditUsagePage from './pages/AuditUsagePage';

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  
  const menuGroups = [
    {
      title: 'Principal',
      items: [
        { path: '/', label: 'Visão Geral', icon: <LayoutDashboard size={18} /> },
      ]
    },
    {
      title: 'Acesso & Licenças',
      items: [
        { path: '/companies', label: 'Empresas (SaaS)', icon: <Building size={18} /> },
        { path: '/tenants', label: 'Gestão de Tenants', icon: <Server size={18} /> },
        { path: '/agent-roles', label: 'Cargos e Permissões', icon: <ShieldAlert size={18} /> },
      ]
    },
    {
      title: 'Inteligência',
      items: [
        { path: '/rag', label: 'RAG & Memórias', icon: <Brain size={18} /> },
        { path: '/tables', label: 'Dic. de Dados Global', icon: <Database size={18} /> },
      ]
    },
    {
      title: 'Governança & API',
      items: [
        { path: '/sync', label: 'Sincronização', icon: <Database size={18} /> },
        { path: '/snapshots', label: 'Snapshots', icon: <Database size={18} /> },
        { path: '/permissions', label: 'Permissões (Escopo)', icon: <ShieldAlert size={18} /> },
        { path: '/guard', label: 'Query Guard', icon: <Activity size={18} /> },
        { path: '/audit', label: 'Auditoria e Consumo', icon: <Settings size={18} /> },
      ]
    },
    {
      title: 'Infraestrutura',
      items: [
        { path: '/infra', label: 'Servidores & Cache', icon: <Cloud size={18} /> },
        { path: '/adminer', label: 'Banco de Dados', icon: <Database size={18} /> },
        { path: '/config', label: 'Configurações Globais', icon: <Settings size={18} /> },
      ]
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900/95 backdrop-blur-2xl border-r border-indigo-500/20 flex flex-col transition-transform duration-300 shadow-[20px_0_40px_rgba(0,0,0,0.5)] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-20 px-6 flex items-center gap-3.5 border-b border-indigo-500/20 shrink-0 bg-slate-900/60 backdrop-blur-md">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-xl text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center animate-pulse">
            <Brain size={22} className="text-white drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent tracking-tight">
              Copilot Protheus
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-sm inline-block mt-0.5">
              AI CONTROL V2
            </span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-7 custom-scrollbar">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[10px] font-mono font-bold text-indigo-400/80 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <span className="w-1 h-3 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500 inline-block"></span>
                {group.title}
              </h2>
              <div className="space-y-1.5">
                {group.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm ${
                        isActive 
                          ? 'border border-indigo-500/50 bg-gradient-to-r from-indigo-600/25 via-purple-600/25 to-indigo-500/10 text-white font-bold shadow-[0_0_20px_rgba(99,102,241,0.25)] scale-[1.01]' 
                          : 'border border-transparent hover:bg-slate-800/60 hover:border-slate-700/60 hover:text-slate-200 text-slate-400 font-medium'
                      }`}
                    >
                      <span className={isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-indigo-500/20 shrink-0 bg-slate-950/70 backdrop-blur-md">
          <div className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-500/30 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              AD
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-slate-100 truncate">Admin Principal</p>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online & Operacional"></span>
              </div>
              <p className="text-xs text-indigo-300/80 truncate flex items-center gap-1 font-mono">
                <Sparkles size={11} className="text-purple-400" /> Acesso Total • AI Online
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Topbar({ toggleSidebar }) {
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {
      // ignora erro de rede — prossegue com logout local
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/admin';
    }
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/companies/')) return 'Dashboard da Empresa';
    switch (location.pathname) {
      case '/': return 'Dashboard Analítico';
      case '/tenants': return 'Gestão de Tenants';
      case '/companies': return 'Empresas (SaaS)';
      case '/agent-users': return 'Usuários do Copilot';
      case '/agent-roles': return 'Cargos e Permissões';
      case '/licenses': return 'Gerenciador de Licenças';
      case '/rag': return 'RAG & Memórias de IA';
      case '/tables': return 'Dicionário de Dados Global';
      case '/adminer': return 'Acesso Direto ao Banco';
      case '/infra': return 'Controle de Infraestrutura';
      case '/config': return 'Configurações de Ambiente';
      case '/sync': return 'Sincronização de Dicionário';
      case '/snapshots': return 'Snapshots Dicionário';
      case '/permissions': return 'Editor de Permissões RAG/SQL';
      case '/guard': return 'Query Guard & Protheus Interceptor';
      case '/audit': return 'Auditoria de Uso e Consumo LLM';
      default: return 'Protheus Control';
    }
  };

  return (
    <header className="h-20 bg-slate-900/85 backdrop-blur-2xl border-b border-indigo-500/20 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-10 shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-slate-400 hover:bg-slate-800/80 rounded-xl transition-colors border border-slate-700/50"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-xl lg:text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            {getPageTitle()}
          </h2>
          <p className="text-[11px] text-indigo-300/70 hidden sm:flex items-center gap-1.5 font-mono tracking-wide mt-0.5">
            <Layers size={12} className="text-indigo-400" /> Orquestração Multiempresa • RAG & SQL Engine
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          <span>Hetzner Cloud Node</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <Cpu size={14} className="text-indigo-400 animate-pulse" />
          <span>Oracle ROWNUM Protected</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-sm font-medium text-slate-300 hover:text-red-400 flex items-center gap-2 transition-all duration-200 px-3.5 py-2 rounded-xl bg-slate-800/70 hover:bg-red-500/15 border border-slate-700/70 hover:border-red-500/30 ml-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut size={16} className="text-red-400" />
          {isLoggingOut ? 'Saindo...' : 'Encerrar Sessão'}
        </button>
      </div>
    </header>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <Router basename="/admin">
      <div className="flex h-screen font-sans overflow-hidden bg-[#0B0F19] text-slate-100 selection:bg-indigo-500 selection:text-white">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-slate-950">
          <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto pb-14">
              <Routes>
                <Route path="/" element={<Logs />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/companies/:id/*" element={<CompanyDashboard />} />
                <Route path="/agent-users" element={<AgentUsers />} />
                <Route path="/agent-roles" element={<AgentRoles />} />
                <Route path="/licenses" element={<Licenses />} />
                <Route path="/rag" element={<RagMemories />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/adminer" element={<Adminer />} />
                <Route path="/infra" element={<Infra />} />
                <Route path="/config" element={<Config />} />
                
                <Route path="/sync" element={<DictionarySyncPage />} />
                <Route path="/snapshots" element={<SnapshotsPage />} />
                <Route path="/permissions" element={<PermissionEditorPage />} />
                <Route path="/guard" element={<QueryGuardPage />} />
                <Route path="/audit" element={<AuditUsagePage />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

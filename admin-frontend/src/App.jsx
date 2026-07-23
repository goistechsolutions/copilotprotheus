import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Database, LayoutDashboard, ShieldAlert, Building, Key, Brain, Cloud, UserCog, LogOut, Menu, Activity, Server } from 'lucide-react';
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
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100 shrink-0">
          <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
            <Activity size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Protheus Control</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                {group.title}
              </h2>
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border ${
                        isActive 
                          ? 'border-slate-300 bg-white shadow-sm text-slate-900 font-semibold' 
                          : 'border-transparent hover:bg-slate-100 hover:text-slate-900 text-sm font-medium text-slate-600'
                      }`}
                    >
                      <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors shadow-sm cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              AD
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-700 truncate">Admin Principal</p>
              <p className="text-xs text-slate-500 truncate">Acesso Total</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Topbar({ toggleSidebar }) {
  const location = useLocation();
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
      default: return 'Protheus Control';
    }
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center gap-2 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 border border-transparent">
          <LogOut size={16} /> Encerrar Sessão
        </button>
      </div>
    </header>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <Router basename="/admin">
      <div className="flex h-screen font-sans overflow-hidden bg-slate-50">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto pb-12">
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

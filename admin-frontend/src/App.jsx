import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Database, LayoutDashboard, ShieldAlert, Building, Key, Brain, Cloud, UserCog, LogOut, Menu, Activity } from 'lucide-react';
import { useState } from 'react';

import Config from './pages/Config';
import AgentUsers from './pages/AgentUsers';
import AgentRoles from './pages/AgentRoles';
import Tables from './pages/Tables';
import Logs from './pages/Logs';
import Companies from './pages/Companies';
import Licenses from './pages/Licenses';
import RagMemories from './pages/RagMemories';
import Adminer from './pages/Adminer';
import Infra from './pages/Infra';

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
        { path: '/companies', label: 'Empresas SaaS', icon: <Building size={18} /> },
        { path: '/agent-users', label: 'Usuários Copilot', icon: <UserCog size={18} /> },
        { path: '/agent-roles', label: 'Cargos e Permissões', icon: <ShieldAlert size={18} /> },
        { path: '/licenses', label: 'Licenças de Uso', icon: <Key size={18} /> },
      ]
    },
    {
      title: 'Inteligência',
      items: [
        { path: '/rag', label: 'RAG & Memórias', icon: <Brain size={18} /> },
        { path: '/tables', label: 'Tabelas Permitidas', icon: <Database size={18} /> },
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
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 glass-panel flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div className="p-2 bg-brand-500/20 rounded-xl text-brand-400">
            <Activity size={20} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Protheus Control</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-[11px] font-bold text-slate-400/80 uppercase tracking-widest mb-3">
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
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                        isActive 
                          ? 'bg-brand-500/20 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] font-medium border border-brand-500/30' 
                          : 'hover:bg-white/5 hover:text-white text-sm text-slate-300 border border-transparent'
                      }`}
                    >
                      <span className={isActive ? 'text-brand-400' : 'text-slate-400'}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/10 shrink-0 bg-black/20">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-xs shadow-lg">
              AD
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">Admin Principal</p>
              <p className="text-xs text-brand-300/80 truncate">Acesso Total</p>
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
    switch (location.pathname) {
      case '/': return 'Dashboard Analítico';
      case '/companies': return 'Gestão de Empresas SaaS';
      case '/agent-users': return 'Usuários do Copilot';
      case '/agent-roles': return 'Cargos e Permissões';
      case '/licenses': return 'Gerenciador de Licenças';
      case '/rag': return 'RAG & Memórias de IA';
      case '/tables': return 'Tabelas Permitidas do ERP';
      case '/adminer': return 'Acesso Direto ao Banco';
      case '/infra': return 'Controle de Infraestrutura';
      case '/config': return 'Configurações de Ambiente';
      default: return 'Protheus Control';
    }
  };

  return (
    <header className="h-16 glass-header flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-sm font-medium text-slate-300 hover:text-rose-400 flex items-center gap-2 transition-colors px-3 py-2 rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20">
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
      <div className="flex h-screen font-sans overflow-hidden bg-transparent">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto pb-12">
              <Routes>
                <Route path="/" element={<Logs />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/agent-users" element={<AgentUsers />} />
                <Route path="/agent-roles" element={<AgentRoles />} />
                <Route path="/licenses" element={<Licenses />} />
                <Route path="/rag" element={<RagMemories />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/adminer" element={<Adminer />} />
                <Route path="/infra" element={<Infra />} />
                <Route path="/config" element={<Config />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;

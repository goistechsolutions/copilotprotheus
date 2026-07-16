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
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#0a1128] text-slate-300 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/5 shrink-0 bg-white/5">
          <Activity className="text-blue-500" size={24} />
          <h1 className="text-lg font-bold text-white tracking-tight">Protheus Control</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
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
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 font-medium' 
                          : 'hover:bg-white/5 hover:text-white text-sm text-slate-400'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/5 shrink-0 bg-white/5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#0a1128] border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-xs shadow-inner">
              AD
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-slate-400 truncate">System Administrator</p>
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
      case '/': return 'Dashboard Geral';
      case '/companies': return 'Gestão de Empresas SaaS';
      case '/agent-users': return 'Usuários do Copilot';
      case '/agent-roles': return 'Cargos e Permissões';
      case '/licenses': return 'Gerenciador de Licenças';
      case '/rag': return 'RAG & Memórias de Longo Prazo';
      case '/tables': return 'Tabelas Permitidas do ERP';
      case '/adminer': return 'Acesso ao Banco de Dados';
      case '/infra': return 'Infraestrutura em Nuvem';
      case '/config': return 'Configurações Globais';
      default: return 'Protheus Control';
    }
  };

  return (
    <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-sm font-medium text-slate-500 hover:text-rose-600 flex items-center gap-2 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </header>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <Router basename="/admin">
      <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-6xl mx-auto pb-12">
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

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Database, LayoutDashboard, ShieldAlert, Building, Key, Brain, Cloud, UserCog } from 'lucide-react';

import Config from './pages/Config';
import AgentUsers from './pages/AgentUsers';
import Tables from './pages/Tables';
import Logs from './pages/Logs';
import Companies from './pages/Companies';
import Licenses from './pages/Licenses';
import RagMemories from './pages/RagMemories';
import Adminer from './pages/Adminer';
import Infra from './pages/Infra';

function Sidebar() {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', label: 'Visão Geral (Logs)', icon: <LayoutDashboard size={20} /> },
    { path: '/companies', label: 'Empresas SaaS', icon: <Building size={20} /> },
    { path: '/agent-users', label: 'Usuários Copilot', icon: <UserCog size={20} /> },
    { path: '/licenses', label: 'Gerador de Licenças', icon: <Key size={20} /> },
    { path: '/rag', label: 'RAG e Memórias', icon: <Brain size={20} /> },
    { path: '/tables', label: 'Tabelas Permitidas', icon: <Database size={20} /> },
    { path: '/adminer', label: 'Banco de Dados', icon: <Database size={20} /> },
    { path: '/infra', label: 'Infraestrutura', icon: <Cloud size={20} /> },
    { path: '/config', label: 'Configurações Globais', icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <ShieldAlert className="text-blue-500" size={28} />
        <h1 className="text-xl font-bold text-white tracking-tight">Protheus Control</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-900/20' 
                : 'hover:bg-slate-800 hover:text-white text-sm'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        Copilot Protheus Admin v2.0
      </div>
    </div>
  );
}

function App() {
  return (
    <Router basename="/admin">
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Logs />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/agent-users" element={<AgentUsers />} />
            <Route path="/licenses" element={<Licenses />} />
            <Route path="/rag" element={<RagMemories />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/adminer" element={<Adminer />} />
            <Route path="/infra" element={<Infra />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

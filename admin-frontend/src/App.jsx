import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Database, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

import Config from './pages/Config';
import Tables from './pages/Tables';
import Logs from './pages/Logs';

function Sidebar() {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', label: 'Métricas e Logs', icon: <LayoutDashboard size={20} /> },
    { path: '/config', label: 'Configurações Globais', icon: <Settings size={20} /> },
    { path: '/tables', label: 'Tabelas Permitidas', icon: <Database size={20} /> }
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <ShieldAlert className="text-blue-500" size={28} />
        <h1 className="text-xl font-bold text-white tracking-tight">Protheus Control</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-900/20' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        Copilot Protheus Admin v1.0
      </div>
    </div>
  );
}

function App() {
  return (
    <Router basename="/admin">
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Logs />} />
            <Route path="/config" element={<Config />} />
            <Route path="/tables" element={<Tables />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

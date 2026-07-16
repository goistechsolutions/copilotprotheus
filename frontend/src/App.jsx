import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // History will store: { role: 'user' | 'assistant', text: string, payload: object | null }
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const chartRefs = useRef({});
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsUser, setSettingsUser] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');

  // Carrega sessoes do localStorage na inicializacao
  useEffect(() => {
    const savedSessions = localStorage.getItem('cprot_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
          setHistory(parsed[0].history || []);
        } else {
          createNewSession();
        }
      } catch(e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Salva no localStorage sempre que o history muda
  useEffect(() => {
    if (currentSessionId && history.length > 0) {
      setSessions(prev => {
        const newSessions = [...prev];
        const idx = newSessions.findIndex(s => s.id === currentSessionId);
        const title = history.find(h => h.role === 'user')?.text || 'Nova Conversa';
        
        if (idx >= 0) {
          newSessions[idx].history = history;
          newSessions[idx].title = title.substring(0, 30) + (title.length > 30 ? '...' : '');
        } else {
          newSessions.unshift({
            id: currentSessionId,
            title: title.substring(0, 30) + (title.length > 30 ? '...' : ''),
            history: history,
            date: new Date().toISOString()
          });
        }
        localStorage.setItem('cprot_sessions', JSON.stringify(newSessions));
        return newSessions;
      });
    }
  }, [history, currentSessionId]);

  const createNewSession = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setHistory([]);
    setIsSidebarOpen(false);
  };

  const loadSession = (id) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(session.id);
      setHistory(session.history || []);
      setIsSidebarOpen(false);
    }
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== id);
      localStorage.setItem('cprot_sessions', JSON.stringify(newSessions));
      if (currentSessionId === id) {
        if (newSessions.length > 0) {
          loadSession(newSessions[0].id);
        } else {
          createNewSession();
        }
      }
      return newSessions;
    });
  };

  // Auto-scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading, error]);

  const handleExportPNG = (idx, titulo) => {
    const chart = chartRefs.current[idx];
    if (chart) {
      const url = chart.toBase64Image();
      const link = document.createElement('a');
      link.download = `${titulo || 'dashboard'}.png`;
      link.href = url;
      link.click();
    }
  };

  const handleExportCSV = (payloadGemini) => {
    if (!payloadGemini) return;
    let csv = '\uFEFFCategoria';
    payloadGemini.datasets.forEach(d => {
      csv += `;${d.label}`;
    });
    csv += '\n';

    const labels = payloadGemini.labels || [];
    labels.forEach((label, i) => {
      csv += `${label}`;
      payloadGemini.datasets.forEach(d => {
        csv += `;${d.dados[i] !== undefined ? d.dados[i] : ''}`;
      });
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payloadGemini.titulo || 'dashboard'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const extractMarkdownTableToCSV = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const tableLines = lines.filter(line => line.trim().startsWith('|') && line.includes('|'));
    if (tableLines.length < 3) return null; 
    
    let csv = '\uFEFF'; 
    tableLines.forEach((line, idx) => {
      if (idx === 1 && line.replace(/[^|\-:]/g, '').length === line.trim().length) return;
      const columns = line.split('|').slice(1, -1).map(c => c.trim().replace(/"/g, '""'));
      csv += columns.join(';') + '\n';
    });
    return csv;
  };

  const hasMarkdownTable = (text) => {
    if (!text) return false;
    const lines = text.split('\n');
    return lines.filter(line => line.trim().startsWith('|') && line.includes('|')).length >= 3;
  };

  const handleExportTextCSV = (text) => {
    const csv = extractMarkdownTableToCSV(text);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'cprot-dashboard-data') {
        const payload = event.data.payloadGemini;
        setIsLoading(false);
        setHistory(prev => [...prev, { 
          role: 'assistant', 
          text: payload.answer || payload.insights || 'Dashboard gerado.',
          payload: payload.datasets ? payload : null
        }]);
      }
      if (event.data && event.data.type === 'cprot-dashboard-error') {
        setError(event.data.error);
        setIsLoading(false);
      }
      if (event.data && event.data.type === 'cprot-screen-data') {
        const textFromScreen = event.data.text;
        const imageFromScreen = event.data.image;
        if (!textFromScreen && !imageFromScreen) {
           setError("Não foi possível ler os dados da tela atual.");
           setIsLoading(false);
           return;
        }
        
        setHistory(prevHistory => {
          const promptText = `Analise a tela atual do sistema que o usuário está visualizando. Extraia e resuma os principais números e painéis que estão sendo mostrados:\n\n[DADOS CAPTURADOS DA TELA]\n${textFromScreen}`;
          const historyForBackend = prevHistory.map(h => ({ role: h.role, text: h.text }));

          if (window.parent) {
            window.parent.postMessage({
              type: 'cprot-request-analysis',
              query: promptText,
              history: historyForBackend,
              image: imageFromScreen
            }, '*');
          }

          return [...prevHistory, { role: 'user', text: 'Analisar tela atual', payload: null }];
        });
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Attempt to load settings from parent if they send it initially
    // or just let the user set it blindly. It's safer to just let them set it.

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (window.parent) {
      window.parent.postMessage({ type: 'cprot-resize', open: isOpen }, '*');
    }
  }, [isOpen]);

  const handleAsk = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!currentSessionId) createNewSession();

    setIsLoading(true);
    setError(null);
    
    const currentQuery = query;
    const historyForBackend = history.map(h => ({ role: h.role, text: h.text }));

    setHistory(prev => [...prev, { role: 'user', text: currentQuery, payload: null }]);

    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: currentQuery,
      history: historyForBackend
    }, '*');
    
    setQuery('');
  };

  const handleAnalyzeScreen = () => {
    if (!currentSessionId) createNewSession();
    setIsLoading(true);
    setError(null);
    if (window.parent) {
      window.parent.postMessage({ type: 'cprot-request-screen' }, '*');
    }
  };

  const cores = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ];
  const borderCores = [
    'rgb(37, 99, 235)',
    'rgb(5, 150, 105)',
    'rgb(124, 58, 237)',
    'rgb(217, 119, 6)',
    'rgb(219, 39, 119)',
  ];

  const getChartDataConfig = (payloadGemini) => {
    return {
      labels: payloadGemini.labels || [],
      datasets: payloadGemini.datasets.map((dataset, i) => ({
        label: dataset.label,
        data: dataset.dados,
        backgroundColor: payloadGemini.tipo_grafico === 'pie' ? cores : cores[i % cores.length],
        borderColor: payloadGemini.tipo_grafico === 'pie' ? borderCores : borderCores[i % borderCores.length],
        borderWidth: 2,
        borderRadius: payloadGemini.tipo_grafico === 'bar' ? 6 : 0,
        tension: 0.4,
        fill: payloadGemini.tipo_grafico === 'line',
      })),
    };
  };

  const chartOptions = (tipo_grafico) => ({ 
    responsive: true, 
    maintainAspectRatio: false,
    plugins: { 
      legend: { position: 'top', labels: { font: { family: 'Inter, sans-serif', weight: 'bold' } } },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleFont: { size: 14, family: 'Inter, sans-serif' },
        bodyFont: { size: 13, family: 'Inter, sans-serif' },
        padding: 12,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: tipo_grafico !== 'pie' ? {
      y: { beginAtZero: true, grid: { color: 'rgba(243, 244, 246, 1)' }, ticks: { font: { family: 'Inter' } } },
      x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
    } : {}
  });

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-blue-600 rounded-full shadow-2xl hover:bg-blue-700 hover:scale-105 transition-transform flex items-center justify-center text-white cursor-pointer border-4 border-white"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans relative shadow-2xl border-l border-gray-200 overflow-hidden">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="absolute inset-0 bg-black/20 z-20 transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar (Drawer) */}
      <div className={`absolute top-0 left-0 h-full w-[280px] bg-white z-30 shadow-2xl transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
          <h3 className="font-bold">Histórico de Chats</h3>
          <button onClick={() => setIsSidebarOpen(false)} className="hover:bg-blue-700 p-1 rounded-full transition text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-3">
          <button onClick={createNewSession} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Nova Conversa
          </button>
          <button onClick={() => { setIsSidebarOpen(false); setIsSettingsOpen(true); }} className="w-full mt-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Configurações
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.map(s => (
            <div 
              key={s.id} 
              onClick={() => loadSession(s.id)}
              className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group transition ${s.id === currentSessionId ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <div className="truncate text-sm font-medium text-gray-700 flex-1 pr-2">
                {s.title}
              </div>
              <button onClick={(e) => deleteSession(s.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
             <div className="text-center text-gray-400 text-sm mt-4">Nenhuma conversa anterior</div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 shadow-sm border-b border-gray-100 flex justify-between items-center z-10 shrink-0">
        
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Configurações de Acesso</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-red-500 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário Copilot</label>
                <input 
                  type="text" 
                  value={settingsUser} 
                  onChange={e => setSettingsUser(e.target.value)} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                  placeholder="Seu usuário"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Copilot</label>
                <input 
                  type="password" 
                  value={settingsPassword} 
                  onChange={e => setSettingsPassword(e.target.value)} 
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                  placeholder="Sua senha"
                />
              </div>
              <button 
                onClick={() => {
                  window.parent.postMessage({ type: 'cprot-save-auth', agent_user: settingsUser, agent_password: settingsPassword }, '*');
                  setIsSettingsOpen(false);
                  alert('Credenciais atualizadas no navegador.');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Salvar Credenciais
              </button>
            </div>
          </div>
        </div>
      )}
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Copilot Protheus
          </h2>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-700 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2"
          title="Fechar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {history.length === 0 && !isLoading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            <p className="max-w-xs text-sm">Olá! Sou o seu Copilot do Protheus. Pergunte sobre vendas, faturamento ou clientes.</p>
          </div>
        )}

        {history.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[95%] p-4 rounded-xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
              
              {/* Texto da mensagem */}
              {(!msg.payload || msg.payload.answer) && (
                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {msg.payload ? msg.payload.answer : msg.text}
                </div>
              )}

              {/* Renderização do Dashboard dentro do balão do assistente */}
              {msg.payload && (
                <div className="mt-4 flex flex-col animate-fade-in-up w-[340px]">
                  <div className="mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">{msg.payload.titulo}</h3>
                      <p className="text-xs font-semibold mt-1 flex items-center gap-1 opacity-80 text-blue-600">
                        Painel Gerencial Interativo
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 w-full h-[250px] relative">
                    {msg.payload.tipo_grafico === 'bar' && <Bar ref={el => chartRefs.current[idx] = el} data={getChartDataConfig(msg.payload)} options={chartOptions(msg.payload.tipo_grafico)} />}
                    {msg.payload.tipo_grafico === 'line' && <Line ref={el => chartRefs.current[idx] = el} data={getChartDataConfig(msg.payload)} options={chartOptions(msg.payload.tipo_grafico)} />}
                    {msg.payload.tipo_grafico === 'pie' && <Pie ref={el => chartRefs.current[idx] = el} data={getChartDataConfig(msg.payload)} options={chartOptions(msg.payload.tipo_grafico)} />}
                  </div>
                  
                  <div className="flex gap-2 mb-2 justify-end">
                    <button onClick={() => handleExportCSV(msg.payload)} className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1 transition border border-gray-200">
                      📊 Exportar (CSV)
                    </button>
                    <button onClick={() => handleExportPNG(idx, msg.payload.titulo)} className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1 transition border border-gray-200">
                      📷 Baixar (PNG)
                    </button>
                  </div>

                  {msg.payload.insights && (
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg mt-2 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                      <span className="text-blue-700 text-xs font-bold uppercase flex items-center gap-1 mb-1">
                        Insight da IA
                      </span>
                      <p className="text-sm leading-relaxed">{msg.payload.insights}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação para Mensagens de Texto do Assistente */}
              {msg.role === 'assistant' && !msg.payload && (
                 <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 justify-end">
                    {hasMarkdownTable(msg.text) && (
                      <button onClick={() => handleExportTextCSV(msg.text)} className="text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1 transition border border-green-200">
                        📊 Excel
                      </button>
                    )}
                    <button onClick={() => handleCopy(msg.text)} className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1 transition border border-gray-200">
                      📋 Copiar
                    </button>
                 </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="bg-white border border-gray-100 p-4 rounded-xl rounded-bl-sm shadow-sm flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-sm font-semibold text-gray-500 animate-pulse">Analisando dados do ERP...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-start">
             <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl rounded-bl-sm shadow-sm text-sm">
                <strong>Erro:</strong> {error}
             </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 shrink-0 relative z-10">
        <form onSubmit={handleAsk} className="flex gap-2">
          <button
            type="button"
            onClick={handleAnalyzeScreen}
            className="bg-gray-100 text-gray-600 w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-200 transition shrink-0 border border-gray-200"
            title="Analisar Tela Atual"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
          </button>
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Pergunte ao Copilot..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-50 shrink-0"
            disabled={isLoading || !query.trim()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>
      </div>
    </div>
  );
}

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
  
  const chartRefs = useRef({});
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

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
    // Adiciona o BOM UTF-8 (\uFEFF) para forçar o Excel a reconhecer a acentuação corretamente
    let csv = '\uFEFFCategoria';
    // Usa ponto-e-vírgula (;) no lugar de vírgula para separar as colunas no padrão PT-BR
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
    };
    window.addEventListener('message', handleMessage);
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

    setIsLoading(true);
    setError(null);
    
    const currentQuery = query;
    // We send history as just text. We map out the payload to avoid sending massive objects back.
    const historyForBackend = history.map(h => ({ role: h.role, text: h.text }));

    setHistory(prev => [...prev, { role: 'user', text: currentQuery, payload: null }]);

    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: currentQuery,
      history: historyForBackend
    }, '*');
    
    setQuery('');
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
    <div className="flex flex-col h-screen bg-gray-50 font-sans relative shadow-2xl border-l border-gray-200">
      <div className="bg-white p-4 shadow-sm border-b border-gray-100 flex justify-between items-center z-10 shrink-0">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Copilot Protheus
        </h2>
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
                      Exportar (CSV)
                    </button>
                    <button onClick={() => handleExportPNG(idx, msg.payload.titulo)} className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1 transition border border-gray-200">
                      Baixar (PNG)
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

      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <form onSubmit={handleAsk} className="flex gap-2">
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

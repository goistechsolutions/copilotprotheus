import React, { useState, useEffect } from 'react';
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

// Registra os componentes necessários do Chart.js
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
  const [payloadGemini, setPayloadGemini] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'cprot-dashboard-data') {
        const payload = event.data.payloadGemini;
        setPayloadGemini(payload);
        setIsLoading(false);
        // Atualiza o history com a resposta
        setHistory(prev => [...prev, { role: 'assistant', text: payload.answer || payload.insights || 'Dashboard gerado.' }]);
      }
      if (event.data && event.data.type === 'cprot-dashboard-error') {
        setError(event.data.error);
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Notifica a extensão para redimensionar o iframe sempre que abrir/fechar
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
    setPayloadGemini(null);
    
    // Atualiza history com a pergunta do usuário
    const currentQuery = query;
    setHistory(prev => [...prev, { role: 'user', text: currentQuery }]);

    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: currentQuery,
      history: history
    }, '*');
    
    setQuery('');
  };

  const cores = [
    'rgba(59, 130, 246, 0.8)', // blue-500
    'rgba(16, 185, 129, 0.8)', // emerald-500
    'rgba(139, 92, 246, 0.8)', // violet-500
    'rgba(245, 158, 11, 0.8)', // amber-500
    'rgba(236, 72, 153, 0.8)', // pink-500
  ];
  const borderCores = [
    'rgb(37, 99, 235)',
    'rgb(5, 150, 105)',
    'rgb(124, 58, 237)',
    'rgb(217, 119, 6)',
    'rgb(219, 39, 119)',
  ];

  let dataConfig = null;
  if (payloadGemini && payloadGemini.datasets) {
    dataConfig = {
      labels: payloadGemini.labels || [],
      datasets: payloadGemini.datasets.map((dataset, i) => ({
        label: dataset.label,
        data: dataset.dados,
        backgroundColor: payloadGemini.tipo_grafico === 'pie' ? cores : cores[i % cores.length],
        borderColor: payloadGemini.tipo_grafico === 'pie' ? borderCores : borderCores[i % borderCores.length],
        borderWidth: 2,
        borderRadius: payloadGemini.tipo_grafico === 'bar' ? 6 : 0,
        tension: 0.4, // smooth curves for line charts
        fill: payloadGemini.tipo_grafico === 'line', // fill under the line
      })),
    };
  }

  const options = { 
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
    scales: payloadGemini?.tipo_grafico !== 'pie' ? {
      y: { beginAtZero: true, grid: { color: 'rgba(243, 244, 246, 1)' }, ticks: { font: { family: 'Inter' } } },
      x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
    } : {}
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4">
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
    <div className="flex flex-col h-screen bg-gray-50 font-sans p-4 relative shadow-2xl border-l border-gray-200">
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2"
        title="Fechar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>

      {/* Área do Chat (Input) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 flex-shrink-0 pr-16">
        <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Copilot Protheus
        </h2>
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Qual foi o faturamento por filial este mês?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            disabled={isLoading || !query.trim()}
          >
            Analisar
          </button>
        </form>
      </div>

      {/* Área de Loading */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100 mb-4 shadow-sm animate-pulse">
          <div className="relative w-16 h-16 flex items-center justify-center mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <p className="font-bold text-gray-700 text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Analisando dados do ERP...
          </p>
          <p className="text-sm text-gray-400 mt-1">Gerando insights com inteligência artificial</p>
        </div>
      )}

      {/* Área de Erro */}
      {error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-xl border border-red-100 p-6 text-center">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <p className="font-semibold text-lg mb-1">Erro na Análise</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Área do Dashboard Gerado ou Resposta em Texto */}
      {!isLoading && !error && payloadGemini && (
        <div className="flex-1 bg-white p-6 rounded-xl shadow-xl border border-gray-100 overflow-y-auto transform transition-all duration-500 ease-in-out opacity-100 translate-y-0 relative z-10">
          {payloadGemini.datasets ? (
            <div className="flex flex-col h-full animate-fade-in-up">
              <div className="mb-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-extrabold text-gray-800 tracking-tight">{payloadGemini.titulo}</h3>
                  <p className="text-sm text-blue-600 font-semibold mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.22 4.624 1 1 0 01-.89.89 8.96 8.96 0 00-4.043 1.05 1 1 0 01-1.05.001h-.001z"></path></svg>
                    Painel Gerencial Interativo
                  </p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                </div>
              </div>

              <div className="mb-8 flex-1 min-h-[300px] w-full relative">
                {payloadGemini.tipo_grafico === 'bar' && <Bar data={dataConfig} options={options} />}
                {payloadGemini.tipo_grafico === 'line' && <Line data={dataConfig} options={options} />}
                {payloadGemini.tipo_grafico === 'pie' && <Pie data={dataConfig} options={options} />}
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-xl shadow-inner mt-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex items-center mb-2 gap-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Insight da IA
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">{payloadGemini.insights}</p>
              </div>
            </div>
          ) : (
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed animate-fade-in-up">
              {payloadGemini.answer || JSON.stringify(payloadGemini, null, 2)}
            </div>
          )}
        </div>
      )}
      
      {!isLoading && !error && !payloadGemini && (
         <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center bg-white rounded-xl border border-gray-100 p-8">
           <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
           <p className="max-w-xs text-sm">Nenhuma análise carregada. Pergunte algo ao Copilot acima para visualizar dashboards dinâmicos.</p>
         </div>
      )}
    </div>
  );
}

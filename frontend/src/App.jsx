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

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'cprot-dashboard-data') {
        setPayloadGemini(event.data.payloadGemini);
        setIsLoading(false);
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

    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: query
    }, '*');
  };

  const cores = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1'];

  let dataConfig = null;
  if (payloadGemini) {
    dataConfig = {
      labels: payloadGemini.labels,
      datasets: payloadGemini.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.dados,
        backgroundColor: payloadGemini.tipo_grafico === 'pie' ? cores : cores[0],
        borderColor: cores[0],
        borderWidth: 1,
      })),
    };
  }

  const options = { responsive: true, plugins: { legend: { position: 'top' } } };

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
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl border border-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="font-medium">Processando via Gemini...</p>
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

      {/* Área do Dashboard Gerado */}
      {!isLoading && !error && payloadGemini && (
        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">{payloadGemini.titulo}</h3>
            <p className="text-xs text-gray-400">Análise inteligente gerada pelo Copilot</p>
          </div>

          <div className="mb-6 h-64 flex items-center justify-center">
            {payloadGemini.tipo_grafico === 'bar' && <Bar data={dataConfig} options={options} />}
            {payloadGemini.tipo_grafico === 'line' && <Line data={dataConfig} options={options} />}
            {payloadGemini.tipo_grafico === 'pie' && <Pie data={dataConfig} />}
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
            <div className="flex items-center mb-1 gap-2">
              <span className="text-blue-600 font-bold text-sm uppercase tracking-wider">Insight da IA</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{payloadGemini.insights}</p>
          </div>
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

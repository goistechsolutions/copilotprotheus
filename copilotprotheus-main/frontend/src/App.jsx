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

  useEffect(() => {
    const handleMessage = (event) => {
      // Segurança: se quiser pode validar event.origin, mas como roda na nuvem
      // e é um iframe consumido pela extensão do Chrome, a extensão injeta sem origin HTTP as vezes.
      
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

  const handleAsk = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setPayloadGemini(null);

    // Manda a pergunta para a extensão fazer o Fetch
    window.parent.postMessage({
      type: 'cprot-request-analysis',
      query: query
    }, '*');
  };

  // Cores institucionais para os gráficos
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

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
    },
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans p-4">
      {/* Área do Chat (Input) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Copilot Protheus</h2>
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
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p>Extraindo dados do Protheus e processando via Gemini...</p>
        </div>
      )}

      {/* Área de Erro */}
      {error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-500">
          <p className="font-semibold text-lg">Erro na Análise</p>
          <p>{error}</p>
        </div>
      )}

      {/* Área do Dashboard Gerado */}
      {!isLoading && !error && payloadGemini && (
        <div className="flex-1 bg-white p-6 rounded-xl shadow-md border border-gray-100 overflow-y-auto">
          {/* Cabeçalho do Dashboard */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">{payloadGemini.titulo}</h3>
            <p className="text-xs text-gray-400">Gerado dinamicamente pelo CopilotProtheus</p>
          </div>

          {/* Área do Gráfico Camaleão */}
          <div className="mb-6 h-64 flex items-center justify-center">
            {payloadGemini.tipo_grafico === 'bar' && <Bar data={dataConfig} options={options} />}
            {payloadGemini.tipo_grafico === 'line' && <Line data={dataConfig} options={options} />}
            {payloadGemini.tipo_grafico === 'pie' && <Pie data={dataConfig} />}
          </div>

          {/* Caixa de Insights da IA */}
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
            <div className="flex items-center mb-1">
              <span className="text-blue-600 font-bold text-sm uppercase tracking-wider">💡 Insight do Agente</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{payloadGemini.insights}</p>
          </div>
        </div>
      )}
      
      {!isLoading && !error && !payloadGemini && (
         <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center">
           <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
           <p className="max-w-xs">Pergunte algo ao Copilot acima para visualizar dashboards dinâmicos.</p>
         </div>
      )}
    </div>
  );
}

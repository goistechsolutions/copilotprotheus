import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Bar } from 'react-chartjs-2';
import { Settings, BarChart3, AlertCircle } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AuditUsagePage() {
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000000');
  const [period, setPeriod] = useState('2026-07');
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/api/agent/usage/${tenantId}/${period}`);
      setUsageData(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const chartData = {
    labels: ['Consumo de Queries Agente'],
    datasets: [
      { label: 'Realizadas', data: [usageData ? usageData.current_queries : 0], backgroundColor: '#4f46e5' },
      { label: 'Disponível', data: [usageData ? Math.max(0, usageData.max_queries - usageData.current_queries) : 100], backgroundColor: '#e2e8f0' },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
          <Settings className="w-6 h-6 mr-3 text-brand-600" /> Auditoria e Consumo (SaaS)
        </h1>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex-1">
          <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-brand-500 focus:border-brand-500" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
        <div className="w-full md:w-48">
          <input type="month" className="w-full px-3 py-2 border rounded-lg focus:ring-brand-500 focus:border-brand-500" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button onClick={loadData} disabled={loading} className="px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {error && <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-xl">{error}</div>}

      {usageData && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-medium text-slate-500">Métricas Principais</h3>
            <p className="text-3xl font-semibold text-brand-600">{usageData.current_queries} <span className="text-sm text-slate-500 font-normal">/ {usageData.max_queries}</span></p>
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 h-[400px]">
            <Bar options={{ responsive: true, maintainAspectRatio: false }} data={chartData} />
          </div>
        </div>
      )}
    </div>
  );
}

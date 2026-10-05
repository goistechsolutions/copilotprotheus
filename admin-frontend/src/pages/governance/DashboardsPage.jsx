import React, { useState, useEffect } from 'react';
import { LayoutGrid, RefreshCw, AlertCircle, Plus, Trash2, Eye, BarChart2, PieChart, Activity } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/governance/dashboards');
      setDashboards(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja excluir este template de dashboard?')) return;
    try {
      await api.delete(`/api/admin/governance/dashboards/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  // Funcao para extrair possiveis KPIs e Tabelas do JSON do Dashboard para enriquecer a UI
  const extractMetadata = (layoutJson) => {
    try {
      const stringified = JSON.stringify(layoutJson);
      const metricsMatch = stringified.match(/"metric_code":\s*"([^"]+)"/g) || [];
      const tablesMatch = stringified.match(/"table_code":\s*"([^"]+)"/g) || [];
      const chartTypesMatch = stringified.match(/"chart_type":\s*"([^"]+)"/g) || [];
      
      const metrics = [...new Set(metricsMatch.map(m => m.split('"')[3]))];
      const tables = [...new Set(tablesMatch.map(t => t.split('"')[3]))];
      const chartTypes = [...new Set(chartTypesMatch.map(c => c.split('"')[3]))];

      return { metrics, tables, chartTypes };
    } catch {
      return { metrics: [], tables: [], chartTypes: [] };
    }
  };

  return (
    <div>
      <PageHeader
        title="Templates de Dashboards"
        description="Layouts executivos de visualização, gráficos e cartões acionados por cada intenção do RAG."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs transition shadow-sm hover:shadow-cyan-500/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {dashboards.length === 0 && !loading ? (
          <div className="col-span-full rounded-xl border border-[#1E293B] bg-[#0F172A] p-10 flex flex-col items-center text-center text-slate-500 text-sm">
            <LayoutGrid className="w-8 h-8 mb-3 opacity-50" />
            Nenhum template de dashboard cadastrado.
            <p className="text-xs mt-1 max-w-sm">
              Os templates de dashboard definem a UI dinâmica que será renderizada para o usuário ao disparar uma intenção analítica.
            </p>
          </div>
        ) : (
          dashboards.map(d => {
            const meta = extractMetadata(d.layout_json);
            return (
              <div key={d.id} className="rounded-xl border border-[#1E293B] bg-[#0F172A] p-5 shadow-sm hover:border-cyan-900/50 transition flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2 uppercase tracking-wider">
                      {d.intent_code}
                    </span>
                    <h3 className="text-white text-base font-semibold">{d.dashboard_code}</h3>
                    <p className="text-xs text-[#8892A4] mt-1">{d.intent_name}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-3 mt-2">
                  {meta.metrics.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> KPIs Associados
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.metrics.map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {meta.chartTypes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                        <PieChart className="w-3 h-3" /> Gráficos
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.chartTypes.map(c => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-[#1E293B] flex items-center justify-between">
                  <button
                    onClick={() => setSelectedDashboard(d)}
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" /> Inspecionar JSON
                  </button>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3" />
                    {Object.keys(d.layout_json || {}).length} Elementos Raiz
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#2B3850] bg-[#0F172A] flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Inspecionando: {selectedDashboard.dashboard_code}</h3>
                <p className="text-xs text-slate-400">Intenção: {selectedDashboard.intent_code}</p>
              </div>
              <button
                onClick={() => setSelectedDashboard(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <pre className="bg-[#020817] p-4 rounded-xl border border-[#1E293B] text-[11px] text-cyan-300 font-mono overflow-x-auto">
                {JSON.stringify(selectedDashboard.layout_json, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

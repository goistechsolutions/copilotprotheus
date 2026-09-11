import { useState, useEffect } from 'react';
import { LayoutGrid, RefreshCw, AlertCircle, Plus, Trash2, Eye } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJson, setSelectedJson] = useState(null);

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
    if (!confirm('Deseja excluir este template de dashboard?')) return;
    try {
      await api.delete(`/api/admin/governance/dashboards/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <PageHeader
        title="Templates de Dashboards"
        description="Layouts executivos de visualização, gráficos e cartões acionados por cada intenção."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 bg-[#161B27] border border-[#1E2535] text-slate-300 hover:text-white rounded-lg text-xs transition"
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dashboards.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[#1E2535] bg-[#161B27] p-8 text-center text-slate-500 text-xs">
            Nenhum template de dashboard cadastrado.
          </div>
        ) : (
          dashboards.map(d => (
            <div key={d.id} className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
                    {d.intent_code}
                  </span>
                  <h3 className="text-white text-base font-semibold">{d.dashboard_code}</h3>
                  <p className="text-xs text-[#8892A4] mt-1">Intenção: {d.intent_name}</p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1E2535] flex items-center justify-between">
                <button
                  onClick={() => setSelectedJson(d.layout_json)}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Estrutura JSON
                </button>
                <span className="text-[10px] text-slate-500">
                  {Object.keys(d.layout_json || {}).length} seções
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#2B3850] bg-[#161B27] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-3">Layout do Dashboard</h3>
            <pre className="max-h-96 overflow-y-auto bg-[#0F1117] p-4 rounded-xl border border-[#1E2535] text-[11px] text-cyan-300 font-mono">
              {JSON.stringify(selectedJson, null, 2)}
            </pre>
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setSelectedJson(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

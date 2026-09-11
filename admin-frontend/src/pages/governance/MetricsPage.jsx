import { useState, useEffect } from 'react';
import { Calculator, RefreshCw, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function MetricsPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [metricCode, setMetricCode] = useState('');
  const [metricName, setMetricName] = useState('');
  const [metricFormula, setMetricFormula] = useState('');
  const [metricType, setMetricType] = useState('currency');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTenants(); }, []);
  useEffect(() => {
    if (selectedTenant) loadMetrics(selectedTenant);
    else setMetrics([]);
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/tenants');
      const list = res.data?.tenants || res.data || [];
      setTenants(list);
      if (list.length > 0) setSelectedTenant(String(list[0].tenant_code || list[0].id));
    } catch {
      setError('Erro ao listar tenants');
    }
  };

  const loadMetrics = async (tId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/governance/metrics?tenant_id=${encodeURIComponent(tId)}`);
      setMetrics(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/admin/governance/metrics', {
        tenant_id: selectedTenant,
        metric_code: metricCode,
        metric_name: metricName,
        metric_formula: metricFormula,
        metric_type: metricType,
      });
      setShowModal(false);
      setMetricCode('');
      setMetricName('');
      setMetricFormula('');
      loadMetrics(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar métrica');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir esta métrica?')) return;
    try {
      await api.delete(`/api/admin/governance/metrics/${id}?tenant_id=${encodeURIComponent(selectedTenant)}`);
      loadMetrics(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <PageHeader
        title="Métricas & KPIs"
        description="Fórmulas e regras de cálculo analítico oficiais configuradas por tenant."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              disabled={!selectedTenant}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Métrica
            </button>
            <button
              onClick={() => loadMetrics(selectedTenant)}
              disabled={!selectedTenant || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#161B27] border border-[#1E2535] text-slate-300 hover:text-white rounded-lg text-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="relative">
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            className="appearance-none bg-[#161B27] border border-[#1E2535] text-white text-xs rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
          >
            {tenants.map(t => {
              const code = t.tenant_code || t.id;
              const name = t.name || t.tenant_name || code;
              return <option key={t.id} value={code}>{code} — {name}</option>;
            })}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[#1E2535] bg-[#161B27] p-8 text-center text-slate-500 text-xs">
            Nenhuma métrica cadastrada para este tenant.
          </div>
        ) : (
          metrics.map(m => (
            <div key={m.id} className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-2">
                    {m.metric_code}
                  </span>
                  <h3 className="text-white text-base font-semibold">{m.metric_name}</h3>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 p-2.5 rounded bg-[#0F1117] border border-[#1E2535]">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Fórmula de Cálculo</div>
                <code className="text-xs text-cyan-300 font-mono break-all">{m.metric_formula}</code>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Tipo: <strong className="text-slate-300 uppercase">{m.metric_type}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#161B27] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Métrica Oficial</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Código (Ex: ticket_medio, inadimplencia_30d)</label>
                <input
                  required
                  value={metricCode}
                  onChange={e => setMetricCode(e.target.value.toLowerCase())}
                  placeholder="ex: churn_rate"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome da Métrica</label>
                <input
                  required
                  value={metricName}
                  onChange={e => setMetricName(e.target.value)}
                  placeholder="Ex: Ticket Médio de Vendas"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fórmula SQL / Agregação</label>
                <textarea
                  rows="2"
                  required
                  value={metricFormula}
                  onChange={e => setMetricFormula(e.target.value)}
                  placeholder="SUM(D2_TOTAL) / COUNT(DISTINCT D2_DOC)"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo de Dado</label>
                <select
                  value={metricType}
                  onChange={e => setMetricType(e.target.value)}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  <option value="currency">Moeda (R$)</option>
                  <option value="percentage">Percentual (%)</option>
                  <option value="quantity">Quantidade</option>
                  <option value="average">Média</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2535]">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar Métrica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

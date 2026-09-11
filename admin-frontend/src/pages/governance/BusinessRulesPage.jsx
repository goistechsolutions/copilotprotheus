import { useState, useEffect } from 'react';
import { Scale, RefreshCw, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function BusinessRulesPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [intentCode, setIntentCode] = useState('');
  const [ruleType, setRuleType] = useState('mandatory_filter');
  const [ruleJsonText, setRuleJsonText] = useState('{\n  "where": "F2_TIPO = \'N\'"\n}');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTenants(); }, []);
  useEffect(() => {
    if (selectedTenant) loadRules(selectedTenant);
    else setRules([]);
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/tenants');
      const list = res.data?.tenants || res.data || [];
      setTenants(list);
      if (list.length > 0) setSelectedTenant(String(list[0].tenant_code || list[0].id));
    } catch {
      setError('Erro ao carregar tenants');
    }
  };

  const loadRules = async (tId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/governance/business-rules?tenant_id=${encodeURIComponent(tId)}`);
      setRules(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar regras de negócio');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsed = JSON.parse(ruleJsonText);
      await api.post('/api/admin/governance/business-rules', {
        tenant_id: selectedTenant,
        intent_code: intentCode,
        rule_type: ruleType,
        rule_json: parsed,
      });
      setShowModal(false);
      setIntentCode('');
      loadRules(selectedTenant);
    } catch (e) {
      alert('JSON inválido ou erro na criação: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir esta regra de negócio?')) return;
    try {
      await api.delete(`/api/admin/governance/business-rules/${id}?tenant_id=${encodeURIComponent(selectedTenant)}`);
      loadRules(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  return (
    <div>
      <PageHeader
        title="Regras de Negócio"
        description="Filtros mandatórios, cláusulas WHERE padrão e regras corporativas aplicadas nas consultas SQL geradas pelo agente."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              disabled={!selectedTenant}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Regra
            </button>
            <button
              onClick={() => loadRules(selectedTenant)}
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
        {rules.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[#1E2535] bg-[#161B27] p-8 text-center text-slate-500 text-xs">
            Nenhuma regra de negócio configurada para este tenant.
          </div>
        ) : (
          rules.map(r => (
            <div key={r.id} className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
                    {r.intent_code}
                  </span>
                  <h3 className="text-white text-sm font-semibold">{r.rule_type}</h3>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 p-2.5 rounded bg-[#0F1117] border border-[#1E2535]">
                <pre className="text-[11px] text-cyan-300 font-mono overflow-x-auto">
                  {typeof r.rule_json === 'string' ? r.rule_json : JSON.stringify(r.rule_json, null, 2)}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#161B27] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Regra de Negócio</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Intent (Ex: billing, receivables, sales_orders)</label>
                <input
                  required
                  value={intentCode}
                  onChange={e => setIntentCode(e.target.value.toLowerCase())}
                  placeholder="ex: billing"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo de Regra</label>
                <select
                  value={ruleType}
                  onChange={e => setRuleType(e.target.value)}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  <option value="mandatory_filter">Filtro Mandatório (WHERE)</option>
                  <option value="join_rule">Regra de JOIN Específica</option>
                  <option value="exclusion">Exclusão Lógica Customizada</option>
                  <option value="aggregation">Regra de Agregação / Group By</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Definição JSON</label>
                <textarea
                  rows="4"
                  required
                  value={ruleJsonText}
                  onChange={e => setRuleJsonText(e.target.value)}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-cyan-300 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2535]">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

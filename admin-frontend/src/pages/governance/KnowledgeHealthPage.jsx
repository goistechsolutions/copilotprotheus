import { useState, useEffect } from 'react';
import { HeartPulse, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle, XCircle, ChevronDown, Table2 } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function KnowledgeHealthPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadTenants(); }, []);
  useEffect(() => {
    if (selectedTenant) loadHealth(selectedTenant);
    else setReport(null);
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

  const loadHealth = async (tId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/governance/health?tenant_id=${encodeURIComponent(tId)}`);
      setReport(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao auditar integridade');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (st) => {
    switch (st) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Saudável
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Crítico (Incompleto)
          </span>
        );
    }
  };

  return (
    <div>
      <PageHeader
        title="Saúde do Conhecimento"
        description="Auditoria em tempo real da cobertura do dicionário Protheus por intenção analítica no tenant selecionado."
        actions={
          <button
            onClick={() => loadHealth(selectedTenant)}
            disabled={!selectedTenant || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Auditar Agora
          </button>
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="relative">
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            className="appearance-none bg-[#0F172A] border border-[#1E293B] text-white text-xs rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
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

      {report?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-[#1E293B] bg-[#0F172A] p-4">
            <div className="text-xs text-slate-400">Total de Intents</div>
            <div className="text-2xl font-bold text-white mt-1">{report.summary.total_intents}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-xs text-emerald-400">Intents Cobertos</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{report.summary.healthy}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="text-xs text-amber-400">Cobertura Parcial</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{report.summary.warning}</div>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="text-xs text-red-400">Intents Bloqueados</div>
            <div className="text-2xl font-bold text-red-300 mt-1">{report.summary.critical}</div>
          </div>
        </div>
      )}

      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#020817] border-b border-[#1E293B] text-[#8892A4] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Intenção / Caso de Uso</th>
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">Status de Cobertura</th>
                <th className="px-4 py-3">Tabelas Necessárias</th>
                <th className="px-4 py-3">Tabelas Faltantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Auditando saúde do conhecimento...
                  </td>
                </tr>
              ) : !report?.intents || report.intents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    Nenhum dado auditado.
                  </td>
                </tr>
              ) : (
                report.intents.map(item => (
                  <tr key={item.intent_code} className="hover:bg-[#1E293B]/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{item.intent_name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{item.intent_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-cyan-400 font-mono text-[11px] font-bold">{item.domain_code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusBadge(item.status)}
                        <span className="text-[10px] text-slate-400">({item.coverage_pct}%)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.required_tables?.map(t => (
                          <span
                            key={t}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                              item.synced_tables.includes(t)
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.missing_tables?.length > 0 ? (
                        <span className="text-red-400 text-[11px] font-mono">
                          {item.missing_tables.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic text-[11px]">Nenhuma tabela pendente</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Layers, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function DomainsPage() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/governance/domains');
      setDomains(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar domínios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title="Domínios ERP"
        description="Mapeamento conceitual de macro-domínios de negócio aos módulos oficiais do Protheus."
        actions={
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs transition">
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
        {domains.map(d => {
          const primaryMod = d.modules?.find(m => m.is_primary) || d.modules?.[0];
          const kpis = 'N/D'; // Pending tenant context
          const health = 'N/D'; // Pending tenant context

          return (
            <div key={d.domain_code} className="flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0F172A] p-5 shadow-sm transition hover:border-[#2b354b]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white text-lg font-bold">{d.name}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {d.domain_code}
                  </span>
                </div>

                <div className="mb-4">
                  <span className="inline-block px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono font-bold text-sm">
                    {primaryMod ? primaryMod.moduleSigla : 'Sem Módulo'}
                  </span>
                  {d.modules?.length > 1 && (
                    <span className="ml-2 text-xs text-slate-500">+{d.modules.length - 1}</span>
                  )}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tabelas vinculadas</span>
                    <span className="text-white font-medium">{d.table_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Intents</span>
                    <span className="text-white font-medium">{d.intent_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">KPIs</span>
                    <span className="text-white font-medium">{kpis}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Saúde</span>
                    <span className="text-emerald-400 font-medium">{health}</span>
                  </div>
                </div>
              </div>

              <button className="w-full py-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-medium text-sm transition hover:bg-cyan-500/20 hover:border-cyan-500/50">
                Abrir Domínio
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


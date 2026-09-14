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
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-[#161B27] border border-[#1E2535] text-slate-300 hover:text-white rounded-lg text-xs transition">
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
        {domains.map(d => (
          <div key={d.domain_code} className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
                  {d.domain_code}
                </span>
                <h3 className="text-white text-base font-semibold">{d.name}</h3>
                <p className="text-xs text-[#8892A4] mt-1 line-clamp-2">{d.description || 'Sem descrição cadastrada.'}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#1E2535]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Módulos Protheus Vinculados
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.modules?.length > 0 ? (
                  d.modules.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0F1117] border border-[#1E2535] text-xs font-mono text-slate-300">
                      <span className="text-cyan-300 font-bold">{m.mod_sigla}</span>
                      <span className="text-slate-500 text-[10px]">(cód. {m.mod_code})</span>
                      {m.is_primary && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1 rounded">Primário</span>}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-600 italic">Nenhum módulo associado</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Table2, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function IntentsPage() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('ALL');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/governance/intents');
      setIntents(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar intents de negócio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const domains = Array.from(new Set(intents.map(i => i.domain_code)));
  const filtered = selectedDomain === 'ALL' ? intents : intents.filter(i => i.domain_code === selectedDomain);

  return (
    <div>
      <PageHeader
        title="Intents de Negócio"
        description="Casos de uso e intenções analíticas compreendidas pelo Copilot Protheus e suas tabelas necessárias."
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

      {/* Filtro por Domínio */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDomain('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            selectedDomain === 'ALL'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-[#161B27] text-slate-400 border border-[#1E2535] hover:text-white'
          }`}
        >
          Todos os Domínios ({intents.length})
        </button>
        {domains.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDomain(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedDomain === d
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#161B27] text-slate-400 border border-[#1E2535] hover:text-white'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(item => (
          <div key={item.id} className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                  {item.domain_code} / {item.intent_code}
                </span>
                <h3 className="text-white text-base font-semibold">{item.name}</h3>
                <p className="text-xs text-[#8892A4] mt-1 line-clamp-2">{item.description || 'Sem descrição.'}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#1E2535]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Tabelas Protheus Mapeadas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.tables?.length > 0 ? (
                  item.tables.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0F1117] border border-[#1E2535] text-xs font-mono text-slate-300">
                      <Table2 className="w-3 h-3 text-cyan-400" />
                      <span className="font-bold text-white">{t.table_code}</span>
                      {t.required ? (
                        <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1 rounded">Obrigatória</span>
                      ) : (
                        <span className="text-[9px] text-slate-500">Opcional</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-600 italic">Nenhuma tabela associada</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

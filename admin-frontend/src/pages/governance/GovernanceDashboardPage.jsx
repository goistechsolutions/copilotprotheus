import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import DomainCard from '../../components/governance/DomainCard';

export default function GovernanceDashboardPage() {
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
      setError(e.response?.data?.detail || 'Erro ao carregar governança');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalDomains = domains.length;
  const totalIntents = domains.reduce((acc, d) => acc + (d.intent_count || 0), 0);
  const totalTables = domains.reduce((acc, d) => acc + (d.table_count || 0), 0);
  // KPIs and Health require tenant context, for global view we can put a placeholder or sum if we change the API
  const totalKpis = 'N/D';
  const overallHealth = 'N/D';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Governança do Conhecimento</h1>
          <p className="text-slate-400 mt-1">Business Knowledge Layer</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs transition">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Domínios" value={totalDomains} />
        <SummaryCard title="Intents" value={totalIntents} />
        <SummaryCard title="KPIs" value={totalKpis} />
        <SummaryCard title="Saúde" value={overallHealth} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Domínios Críticos</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {domains.map(domain => (
            <DomainCard key={domain.domain_code} domain={domain} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
      <p className="text-slate-400 mb-1">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

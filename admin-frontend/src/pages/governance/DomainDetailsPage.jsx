import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Database, Sparkles, Calculator, HeartPulse, LayoutGrid } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function DomainDetailsPage() {
  const { id } = useParams();
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app we'd fetch specific domain details
    // For now we simulate fetching by grabbing the global list
    api.get('/api/admin/governance/domains')
      .then(res => {
        const found = res.data.find(d => d.domain_code === id);
        setDomain(found);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando domínio...</div>;
  }

  if (!domain) {
    return <div className="p-8 text-center text-red-400">Domínio não encontrado.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/governance" className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar para Governança
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-white">{domain.name}</h1>
          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-sm">
            {domain.domain_code}
          </span>
        </div>
        <p className="text-slate-400 mt-2">{domain.description || 'Nenhuma descrição fornecida.'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Resumo</h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-2"><Database className="w-4 h-4 text-cyan-400"/> Tabelas</span>
                <span className="font-bold text-white">{domain.table_count || 0}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-400"/> Intents</span>
                <span className="font-bold text-white">{domain.intent_count || 0}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-400"/> KPIs</span>
                <span className="font-bold text-white">N/D</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-amber-400"/> Dashboards</span>
                <span className="font-bold text-white">N/D</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-red-400"/> Saúde do Domínio
            </h3>
            <div className="text-3xl font-bold text-emerald-400 mb-2">96%</div>
            <p className="text-xs text-slate-500">Simulação estática.</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           {/* Dependency Tree Placeholder */}
           <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Módulos Vinculados</h2>
              <div className="flex flex-wrap gap-2">
                {domain.modules?.map(m => (
                  <div key={m.id} className="px-4 py-2 rounded-lg bg-[#020817] border border-slate-800 font-mono text-cyan-300">
                    {m.mod_sigla} <span className="text-slate-500 text-xs ml-2">({m.mod_code})</span>
                  </div>
                ))}
              </div>
           </div>

           <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Intents Exploradas</h2>
              <p className="text-slate-400 text-sm">Visualize as intenções detalhadas na aba de Intents.</p>
              <Link to="/governance/intents" className="mt-4 inline-block px-4 py-2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm hover:bg-cyan-500/20 transition">
                Explorar Intents
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
}

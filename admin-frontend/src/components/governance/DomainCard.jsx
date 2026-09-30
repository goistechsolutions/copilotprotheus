import { Database, Activity, LayoutGrid, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function DomainCard({ domain }) {
  const primaryMod = domain.modules?.find(m => m.is_primary) || domain.modules?.[0];
  const modSigla = primaryMod ? primaryMod.moduleSigla : 'Sem Módulo';

  return (
    <div className="rounded-2xl bg-[#0F172A] border border-slate-800 p-6 hover:border-cyan-500 transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-white">{domain.name}</h3>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                {domain.domain_code}
            </span>
        </div>
        <p className="text-slate-400 mt-2 mb-6 font-mono text-sm">{modSigla}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Stat icon={<Database size={18} />} label="Tabelas" value={domain.table_count || 0} />
          <Stat icon={<Activity size={18} />} label="Intents" value={domain.intent_count || 0} />
          <Stat icon={<BarChart3 size={18} />} label="KPIs" value={domain.kpi_count || 'N/D'} />
          <Stat icon={<LayoutGrid size={18} />} label="Saúde" value={`${domain.health || 'N/D'}`} />
        </div>
      </div>
      <Link to={`/governance/domains/${domain.domain_code}`} className="block text-center w-full py-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-medium text-sm transition hover:bg-cyan-500/20 hover:border-cyan-500/50">
        Abrir Domínio
      </Link>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-[#1E293B] p-4">
      <div className="mb-2 text-cyan-400">{icon}</div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="font-semibold text-lg text-white">{value}</p>
    </div>
  );
}


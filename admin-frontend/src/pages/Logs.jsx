import { useMemo, useState } from 'react';
import { Activity, RefreshCw, Filter, AlertCircle, Info, AlertTriangle, CheckCircle2, Server, ShieldCheck } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const LEVEL_CONFIG = {
  ERROR:   { variant: 'red',    icon: AlertCircle,    bg: 'bg-red-500/5 border-red-500/10' },
  WARNING: { variant: 'yellow', icon: AlertTriangle,  bg: 'bg-amber-500/5 border-amber-500/10' },
  INFO:    { variant: 'blue',   icon: Info,           bg: 'bg-[#1565C0]/5 border-[#1565C0]/10' },
  DEBUG:   { variant: 'default', icon: CheckCircle2,  bg: 'bg-[#1E2535]/40 border-[#1E2535]' },
};

const SERVICES = ['backend', 'middleware', 'frontend', 'db', 'cloudflared'];

function LogList({ logs, loading, emptyMessage }) {
  if (loading) {
    return <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!logs.length) {
    return <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 text-center"><p className="text-[#8892A4] text-sm">{emptyMessage}</p></div>;
  }
  return (
    <div className="space-y-1.5 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
      {logs.map((log, i) => {
        const lvl = (log.level || log.severity || 'INFO').toUpperCase();
        const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.INFO;
        const Icon = cfg.icon;
        return (
          <div key={`${i}-${log.message}`} className={`flex items-start gap-3 px-4 py-3 border rounded-lg ${cfg.bg}`}>
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${lvl === 'ERROR' ? 'text-red-400' : lvl === 'WARNING' ? 'text-amber-400' : lvl === 'INFO' ? 'text-[#2196F3]' : 'text-[#8892A4]'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><Badge variant={cfg.variant}>{lvl}</Badge><span className="text-[#8892A4] text-xs">relay do host Hetzner</span></div>
              <p className="text-white text-sm break-words font-mono">{log.message || log.msg || JSON.stringify(log)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Logs() {
  const [level, setLevel] = useState('ALL');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('audit');
  const [service, setService] = useState('backend');
  const audit = useApi('/api/admin/logs?limit=200');
  const container = useApi(`/api/infra/container-logs?service=${encodeURIComponent(service)}&limit=300`);
  const diagnostic = useApi('/api/infra/queryrest-diagnostic?limit=300');

  const auditRaw = Array.isArray(audit.data) ? audit.data : (audit.data?.logs ?? audit.data?.items ?? []);
  const auditFiltered = useMemo(() => auditRaw.filter(log => {
    const lvl = (log.level || log.severity || '').toUpperCase();
    if (level !== 'ALL' && lvl !== level) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [log.message, log.module, log.tenant_id].filter(Boolean).join(' ').toLowerCase().includes(s);
  }), [auditRaw, level, search]);

  const containerEntries = container.data?.entries || [];
  const diagnosticEntries = diagnostic.data?.entries || [];
  const activeRefetch = tab === 'audit' ? audit.refetch : tab === 'diagnostic' ? diagnostic.refetch : container.refetch;
  const activeLoading = tab === 'audit' ? audit.loading : tab === 'diagnostic' ? diagnostic.loading : container.loading;
  const activeError = tab === 'audit' ? audit.error : tab === 'diagnostic' ? diagnostic.error : container.error;

  return (
    <div>
      <PageHeader title="Logs & Auditoria" description="Eventos administrativos e observabilidade sanitizada do Hetzner" actions={<button onClick={activeRefetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all" title="Atualizar logs"><RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} /></button>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <button onClick={() => setTab('audit')} className={`text-left rounded-xl border p-4 transition ${tab === 'audit' ? 'border-[#2196F3] bg-[#1565C0]/10' : 'border-[#1E2535] bg-[#161B27] hover:border-[#334155]'}`}><Activity className="w-4 h-4 text-[#2196F3] mb-2" /><p className="text-white text-sm font-semibold">Auditoria da aplicação</p><p className="text-[#8892A4] text-xs mt-1">Eventos administrativos persistidos</p></button>
        <button onClick={() => setTab('containers')} className={`text-left rounded-xl border p-4 transition ${tab === 'containers' ? 'border-[#2196F3] bg-[#1565C0]/10' : 'border-[#1E2535] bg-[#161B27] hover:border-[#334155]'}`}><Server className="w-4 h-4 text-[#2196F3] mb-2" /><p className="text-white text-sm font-semibold">Containers Hetzner</p><p className="text-[#8892A4] text-xs mt-1">Logs sanitizados do relay do host</p></button>
        <button onClick={() => setTab('diagnostic')} className={`text-left rounded-xl border p-4 transition ${tab === 'diagnostic' ? 'border-emerald-400 bg-emerald-500/10' : 'border-[#1E2535] bg-[#161B27] hover:border-[#334155]'}`}><ShieldCheck className="w-4 h-4 text-emerald-400 mb-2" /><p className="text-white text-sm font-semibold">Diagnóstico QueryRest</p><p className="text-[#8892A4] text-xs mt-1">Confirma endpoint sem exibir SQL ou tokens</p></button>
      </div>

      {tab === 'audit' && <div className="flex flex-wrap items-center gap-3 mb-4"><div className="flex items-center gap-1.5 bg-[#161B27] border border-[#1E2535] rounded-lg p-1">{['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map(l => <button key={l} onClick={() => setLevel(l)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${level === l ? 'bg-[#1565C0] text-white' : 'text-[#8892A4] hover:text-white hover:bg-[#1E2535]'}`}>{l}</button>)}</div><div className="relative flex-1 max-w-xs"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8892A4]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar mensagem, módulo..." className="w-full bg-[#161B27] border border-[#1E2535] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] transition-all" /></div><span className="text-[#8892A4] text-xs ml-auto">{auditFiltered.length} entradas</span></div>}

      {tab === 'containers' && <div className="flex flex-wrap items-center gap-3 mb-4"><label className="text-xs text-[#8892A4]">Serviço<select value={service} onChange={e => setService(e.target.value)} className="ml-2 bg-[#161B27] border border-[#1E2535] rounded-lg px-3 py-2 text-sm text-white"><option value="backend">backend</option><option value="middleware">middleware</option><option value="frontend">frontend</option><option value="db">db</option><option value="cloudflared">cloudflared</option></select></label><span className="text-[#8892A4] text-xs ml-auto">{container.data?.available ? `${containerEntries.length} linhas` : 'relay indisponível'}</span></div>}

      {tab === 'diagnostic' && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-[#CBD5E1]"><p className="font-semibold text-emerald-300">Diagnóstico sanitizado</p><p className="mt-1">Exibe somente eventos relacionados a `/queryrest/QueryRest`. Tokens, segredos e SQL foram removidos pelo backend.</p></div>}

      {activeError && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Não foi possível carregar os logs: {activeError}</div>}
      <LogList logs={tab === 'audit' ? auditFiltered : tab === 'diagnostic' ? diagnosticEntries : containerEntries} loading={activeLoading} emptyMessage={tab === 'audit' ? 'Nenhum log encontrado' : 'Nenhum log sanitizado disponível para o serviço selecionado.'} />
    </div>
  );
}

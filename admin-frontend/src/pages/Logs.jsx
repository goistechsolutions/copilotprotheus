import { useState } from 'react';
import { RefreshCw, Filter, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const LEVEL_CONFIG = {
  ERROR:   { variant: 'red',    icon: AlertCircle,    bg: 'bg-red-500/5 border-red-500/10' },
  WARNING: { variant: 'yellow', icon: AlertTriangle,  bg: 'bg-amber-500/5 border-amber-500/10' },
  INFO:    { variant: 'blue',   icon: Info,           bg: 'bg-[#1565C0]/5 border-[#1565C0]/10' },
  DEBUG:   { variant: 'default',icon: CheckCircle2,   bg: 'bg-[#1E2535]/40 border-[#1E2535]' },
};

export default function Logs() {
  const { data, loading, refetch } = useApi('/api/admin/logs?limit=200');
  const [level, setLevel] = useState('ALL');
  const [search, setSearch] = useState('');

  const raw = Array.isArray(data) ? data : (data?.logs ?? data?.items ?? []);

  const filtered = raw.filter(log => {
    const lvl = (log.level || log.severity || '').toUpperCase();
    if (level !== 'ALL' && lvl !== level) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (log.message || '').toLowerCase().includes(s) ||
        (log.module || '').toLowerCase().includes(s) ||
        (log.tenant_id || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Logs & Auditoria"
        description="Eventos do sistema em tempo quase real"
        actions={
          <button onClick={refetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-[#161B27] border border-[#1E2535] rounded-lg p-1">
          {['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                level === l
                  ? 'bg-[#1565C0] text-white'
                  : 'text-[#8892A4] hover:text-white hover:bg-[#1E2535]'
              }`}
            >{l}</button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8892A4]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar mensagem, módulo..."
            className="w-full bg-[#161B27] border border-[#1E2535] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] transition-all"
          />
        </div>
        <span className="text-[#8892A4] text-xs ml-auto">{filtered.length} entradas</span>
      </div>

      {loading ? (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 text-center">
          <p className="text-[#8892A4] text-sm">Nenhum log encontrado</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filtered.map((log, i) => {
            const lvl = (log.level || log.severity || 'INFO').toUpperCase();
            const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.INFO;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 border rounded-lg ${cfg.bg}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${
                  lvl === 'ERROR' ? 'text-red-400' :
                  lvl === 'WARNING' ? 'text-amber-400' :
                  lvl === 'INFO' ? 'text-[#2196F3]' : 'text-[#8892A4]'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={cfg.variant}>{lvl}</Badge>
                    {log.module && <span className="text-[#8892A4] text-xs">{log.module}</span>}
                    {log.tenant_id && <Badge variant="default">{log.tenant_id}</Badge>}
                    <span className="text-[#8892A4] text-xs ml-auto shrink-0">
                      {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : ''}
                    </span>
                  </div>
                  <p className="text-white text-sm break-words">{log.message || log.msg || JSON.stringify(log)}</p>
                  {log.details && <p className="text-[#8892A4] text-xs mt-1 font-mono">{JSON.stringify(log.details)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../api/axios';
import { FileSearch, RefreshCw, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const statusCfg = {
  done:       { label: 'Concluído',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  pending:    { label: 'Em andamento', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20',    icon: Clock },
  processing: { label: 'Processando', cls: 'bg-blue-500/15 text-[#2196F3] border-blue-500/20',       icon: RefreshCw },
  error:      { label: 'Erro',        cls: 'bg-red-500/15 text-red-400 border-red-500/20',            icon: AlertCircle },
};

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/api/admin/snapshots');
      setSnapshots(data?.snapshots || data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar snapshots');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remover este snapshot?')) return;
    try { await api.delete(`/api/admin/snapshots/${id}`); load(); } catch {}
  };

  return (
    <div>
      <PageHeader
        title="Snapshots"
        description="Histórico de extractions do dicionário Protheus."
        action={<button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-[#1E2535] hover:bg-[#2196F3]/20 border border-[#1E2535] hover:border-[#2196F3]/40 text-[#8892A4] hover:text-white text-sm rounded-lg transition-all"><RefreshCw className="w-4 h-4" />Atualizar</button>}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E2535] flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-[#2196F3]" />
          <span className="text-white text-sm font-semibold">Extractions ({snapshots.length})</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#1E2535]">
              <tr>
                {['Código','Tenant','Módulos','Status','Criado em',''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-[#8892A4] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2535]">
              {snapshots.map(s => {
                const cfg = statusCfg[s.status] || statusCfg.pending;
                const Icon = cfg.icon;
                return (
                  <tr key={s.id} className="hover:bg-[#1E2535]/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-white text-xs">{s.snapshot_code || s.code || s.id}</td>
                    <td className="px-5 py-3 text-[#8892A4] text-xs font-mono truncate max-w-[140px]">{s.tenant_id}</td>
                    <td className="px-5 py-3">
                      {(s.modules || s.modulos || []).map(m => (
                        <span key={m} className="inline-block text-[10px] bg-[#0F1117] border border-[#1E2535] text-[#8892A4] px-1.5 py-0.5 rounded mr-1">{m}</span>
                      ))}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#8892A4] text-xs">
                      {s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {snapshots.length === 0 && (
                <tr><td colSpan={6} className="text-center py-16 text-[#8892A4]">
                  <FileSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum snapshot encontrado. Execute uma sincronização primeiro.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

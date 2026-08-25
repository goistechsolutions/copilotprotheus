import { useMemo, useState } from 'react';
import api from '../api/axios';
import { Database, Play, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function DictionarySyncPage() {
  const [tenantId, setTenantId]       = useState('00000000-0000-0000-0000-000000000000');
  const [companyId, setCompanyId]     = useState('');
  const [envId, setEnvId]             = useState('');
  const [modules, setModules]         = useState('');
  const [snapshotCode, setSnapshotCode] = useState('');
  const [status, setStatus]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const payload = useMemo(() => ({
    tenant_id: tenantId,
    company_id: companyId || null,
    env_id: envId || null,
    modules: modules ? modules.split(',').map(v => v.trim()).filter(Boolean) : null,
    snapshot_code: snapshotCode || null,
    requested_by: 'admin-dashboard',
  }), [tenantId, companyId, envId, modules, snapshotCode]);

  const startSync = async () => {
    setLoading(true); setError(''); setStatus(null);
    try {
      const { data } = await api.post('/api/admin/sync/dictionary/start', payload);
      setStatus(data);
      if (data.snapshot_code) setSnapshotCode(data.snapshot_code);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    }
    setLoading(false);
  };

  const Field = ({ label, value, onChange, placeholder, span }) => (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-[#8892A4] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all font-mono"
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Sincronizar Dicionário"
        description="Dispara a extração de metadados do Protheus e cria um novo Snapshot de governança."
      />

      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-6 space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tenant ID *"      value={tenantId}     onChange={setTenantId}     placeholder="UUID do Cliente" />
          <Field label="Company ID"        value={companyId}    onChange={setCompanyId}    placeholder="UUID da Empresa (opcional)" />
          <Field label="Environment ID"    value={envId}        onChange={setEnvId}        placeholder="UUID do Ambiente (opcional)" />
          <Field label="Módulos"           value={modules}      onChange={setModules}      placeholder="Ex: SIGAFAT, SIGAFIN" />
          <Field label="Snapshot Code"     value={snapshotCode} onChange={setSnapshotCode} placeholder="Ex: v1.0.0-fat (opcional)" span />
        </div>

        <div className="pt-4 border-t border-[#1E2535] flex justify-end">
          <button
            disabled={loading || !tenantId}
            onClick={startSync}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#1565C0] to-[#2196F3] hover:from-[#1976D2] hover:to-[#42A5F5] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all shadow-lg shadow-[#1565C0]/20"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando Worker...</> : <><Play className="w-4 h-4" /> Iniciar Sincronização</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 max-w-3xl flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-medium">Falha ao iniciar</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4 max-w-3xl flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-emerald-400 text-sm font-medium">Job aceito — rodando em background</p>
            <p className="text-[#8892A4] text-sm">Status: <span className="text-white font-mono">{status.status}</span></p>
            <p className="text-[#8892A4] text-sm">Código: <span className="text-white font-mono bg-[#0F1117] px-2 py-0.5 rounded">{status.snapshot_code}</span></p>
            <p className="text-[#8892A4]/70 text-xs flex items-center gap-1 mt-1">
              <Info className="w-3.5 h-3.5" /> Acompanhe o progresso em <strong className="text-[#2196F3]">Catálogo → Snapshots</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

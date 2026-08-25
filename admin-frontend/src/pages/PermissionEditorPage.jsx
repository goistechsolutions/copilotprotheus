import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function PermissionEditorPage() {
  const [tenants, setTenants]       = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tables, setTables]         = useState([]);
  const [perms, setPerms]           = useState({});
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  useEffect(() => {
    api.get('/api/admin/tenants').then(r => setTenants(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/admin/schemas?tenant_id=${selectedTenant}`),
      api.get(`/api/admin/permissions?tenant_id=${selectedTenant}`),
    ]).then(([schRes, permRes]) => {
      setTables(schRes.data.schemas || []);
      const map = {};
      (permRes.data || []).forEach(p => { map[p.table_name] = p.allowed; });
      setPerms(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedTenant]);

  const toggle = (table) => setPerms(p => ({ ...p, [table]: !p[table] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/api/admin/permissions', { tenant_id: selectedTenant, permissions: perms });
      showToast('success', 'Permissões salvas com sucesso.');
    } catch {
      showToast('error', 'Erro ao salvar permissões.');
    }
    setSaving(false);
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div>
      <PageHeader title="Permissões de Tabelas" description="Controle quais tabelas do dicionário cada tenant pode consultar." />

      <div className="flex items-end gap-3 mb-5">
        <div className="relative">
          <select
            value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
            className="appearance-none bg-[#161B27] border border-[#1E2535] text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-[#2196F3] transition-all cursor-pointer min-w-[220px]"
          >
            <option value="">Selecione um Tenant</option>
            {tenants.map(t => (
              <option key={t.id} value={t.tenant_id}>{t.razao_social || t.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
        </div>
        {selectedTenant && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all">
            <ShieldCheck className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Permissões'}
          </button>
        )}
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {selectedTenant && (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1E2535] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#2196F3]" />
            <span className="text-white text-sm font-semibold">Tabelas ({tables.length})</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[#1E2535]">
                <tr>
                  {['Tabela','Módulo','Descrição','Acesso'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-[#8892A4] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2535]">
                {tables.map(t => (
                  <tr key={t.id} className="hover:bg-[#1E2535]/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-white text-xs">{t.tabela}</td>
                    <td className="px-5 py-3 text-[#8892A4] text-xs font-mono">{t.modulo}</td>
                    <td className="px-5 py-3 text-[#8892A4] text-xs truncate max-w-xs">{t.nome}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggle(t.tabela)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          perms[t.tabela] ? 'bg-[#1565C0]' : 'bg-[#1E2535]'
                        }`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          perms[t.tabela] ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

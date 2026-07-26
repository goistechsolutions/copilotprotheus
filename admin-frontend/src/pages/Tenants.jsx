import { useState } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Building2, X, Save, Loader2, Globe } from 'lucide-react';
import { useApi, apiCall } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

const EMPTY = { tenant_code: '', tenant_name: '', protheus_rest_url: '', plan_code: '', status: 'active' };

function TenantModal({ tenant, onClose, onSaved }) {
  const [form, setForm] = useState(tenant || EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!tenant?.id;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      if (isEdit) {
        await apiCall(`/api/tenants/${form.id}`, 'PUT', form);
      } else {
        await apiCall('/api/tenants/', 'POST', form);
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const F = ({ label, name, placeholder, type = 'text' }) => (
    <div>
      <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2535]">
          <h2 className="text-white font-semibold">{isEdit ? 'Editar Tenant' : 'Novo Tenant'}</h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Código" name="tenant_code" placeholder="elitecorp" />
            <F label="Nome" name="tenant_name" placeholder="EliteCorp" />
          </div>
          <F label="URL REST Protheus" name="protheus_rest_url" placeholder="https://erp.empresa.com.br:8080" />
          <div className="grid grid-cols-2 gap-4">
            <F label="Plano" name="plan_code" placeholder="pro" />
            <div>
              <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={form.status || 'active'}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>
          </div>
          {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8892A4] hover:text-white border border-[#1E2535] rounded-lg hover:border-[#2196F3]/40 transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1565C0] hover:bg-[#1976D2] text-white rounded-lg font-medium transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const statusVariant = { active: 'green', inactive: 'default', suspended: 'red' };
const statusLabel = { active: 'Ativo', inactive: 'Inativo', suspended: 'Suspenso' };

export default function Tenants() {
  const { data, loading, refetch } = useApi('/api/tenants/');
  const [modal, setModal] = useState(null); // null | 'new' | {tenant}

  const tenants = Array.isArray(data) ? data : (data?.items ?? data?.tenants ?? []);

  const columns = [
    { key: 'tenant_code', label: 'Código' },
    { key: 'tenant_name', label: 'Nome' },
    {
      key: 'protheus_rest_url', label: 'URL REST',
      render: v => v
        ? <span className="flex items-center gap-1 text-[#2196F3] text-xs"><Globe className="w-3 h-3" />{v.length > 35 ? v.slice(0, 35) + '…' : v}</span>
        : <span className="text-[#8892A4] text-xs">—</span>
    },
    { key: 'plan_code', label: 'Plano', render: v => v ? <Badge variant="blue">{v}</Badge> : '—' },
    {
      key: 'status', label: 'Status',
      render: v => <Badge variant={statusVariant[v] || 'default'}>{statusLabel[v] || v}</Badge>
    },
    {
      key: 'id', label: 'Ações',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setModal(row)} className="p-1.5 text-[#8892A4] hover:text-[#2196F3] hover:bg-[#1565C0]/10 rounded-md transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tenants & Empresas"
        description="Gerencie os tenants e suas configurações de conexão Protheus"
        actions={
          <>
            <button onClick={refetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setModal('new')}
              className="flex items-center gap-2 px-3 py-2 bg-[#1565C0] hover:bg-[#1976D2] text-white text-sm font-medium rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" /> Novo Tenant
            </button>
          </>
        }
      />

      {loading ? (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={tenants} />
      )}

      {modal && (
        <TenantModal
          tenant={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

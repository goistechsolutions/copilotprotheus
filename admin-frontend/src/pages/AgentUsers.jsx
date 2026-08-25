import { useState } from 'react';
import { Plus, RefreshCw, Edit2, User, X, Save, Loader2, ShieldCheck } from 'lucide-react';
import { useApi, apiCall } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

const EMPTY = { username: '', password: '', role: 'user', tenant_id: 'default' };

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(user ? { ...user, password: '' } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!user?.id;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (isEdit) {
        await apiCall(`/api/admin/users/${form.id}`, 'PUT', payload);
      } else {
        await apiCall('/api/admin/users', 'POST', payload);
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2535]">
          <h2 className="text-white font-semibold">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Tenant</label>
            <input value={form.tenant_id} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value }))}
              className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              placeholder="default" />
          </div>
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Usuário</label>
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              placeholder="joao.silva" />
          </div>
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">
              {isEdit ? 'Nova Senha (opcional)' : 'Senha'}
            </label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required={!isEdit}
              className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Perfil</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="analyst">Analista</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>
          {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8892A4] hover:text-white border border-[#1E2535] rounded-lg transition-all">Cancelar</button>
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

const roleVariant = { admin: 'red', analyst: 'yellow', user: 'blue', viewer: 'default' };
const roleLabel = { admin: 'Admin', analyst: 'Analista', user: 'Usuário', viewer: 'Visualizador' };

export default function AgentUsers() {
  const { data, loading, refetch } = useApi('/api/admin/users');
  const [modal, setModal] = useState(null);

  const users = Array.isArray(data) ? data : (data?.users ?? data?.items ?? []);

  const columns = [
    { key: 'id', label: 'ID', render: v => <span className="text-[#8892A4] text-xs font-mono">{v}</span> },
    {
      key: 'username', label: 'Usuário',
      render: (v) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#1565C0]/20 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-[#2196F3]" />
          </div>
          <span className="text-white text-sm font-medium">{v}</span>
        </div>
      )
    },
    { key: 'tenant_id', label: 'Tenant', render: v => <Badge variant="default">{v || 'default'}</Badge> },
    {
      key: 'role', label: 'Perfil',
      render: v => (
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#8892A4]" />
          <Badge variant={roleVariant[v] || 'default'}>{roleLabel[v] || v}</Badge>
        </div>
      )
    },
    {
      key: 'created_at', label: 'Criado em',
      render: v => v ? <span className="text-[#8892A4] text-xs">{new Date(v).toLocaleDateString('pt-BR')}</span> : '—'
    },
    {
      key: 'id', label: 'Ações',
      render: (_, row) => (
        <button onClick={() => setModal(row)} className="p-1.5 text-[#8892A4] hover:text-[#2196F3] hover:bg-[#1565C0]/10 rounded-md transition-all">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuários & Permissões"
        description="Gerencie os usuários do agente Copilot Protheus"
        actions={
          <>
            <button onClick={refetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setModal('new')} className="flex items-center gap-2 px-3 py-2 bg-[#1565C0] hover:bg-[#1976D2] text-white text-sm font-medium rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Novo Usuário
            </button>
          </>
        }
      />
      {loading ? (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={users} />
      )}
      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

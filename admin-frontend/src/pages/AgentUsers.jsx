import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit2, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

const EMPTY = { tenant_id: '', email: '', full_name: '', password: '', role_code: '' };

function listFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function UserModal({ user, tenants, roles, onClose, onSaved }) {
  const [form, setForm] = useState(user ? { tenant_id: user.tenant_id || '', email: user.email || '', full_name: user.full_name || '', password: '', role_code: user.role_code || '' } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(user?.id);

  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  const save = async event => {
    event.preventDefault();
    if (!form.tenant_id || !form.email || (!isEdit && !form.password)) {
      setError('Tenant, e-mail e senha são obrigatórios para criar um usuário.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const payload = { full_name: form.full_name, status: user.status || 'active' };
        if (form.password) payload.password = form.password;
        if (form.role_code) payload.role_code = form.role_code;
        await api.put(`/api/admin/users/${user.id}`, payload);
      } else {
        await api.post('/api/admin/users', { tenant_id: form.tenant_id, email: form.email.trim(), full_name: form.full_name.trim() || 'Usuário do Sistema', password: form.password, role_code: form.role_code || 'tenant_admin' });
      }
      onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-[#2B3850] bg-[#161B27] shadow-2xl"><div className="flex items-center justify-between border-b border-[#1E2A3D] px-6 py-4"><div><h2 className="text-base font-semibold text-white">{isEdit ? 'Editar usuário' : 'Novo usuário'}</h2><p className="mt-1 text-xs text-[#94A3B8]">As alterações ficam vinculadas ao tenant selecionado.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#1E2535] hover:text-white"><X className="h-5 w-5" /></button></div><form onSubmit={save} className="space-y-4 p-6">
    {!isEdit && <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Tenant *</span><select value={form.tenant_id} onChange={event => update('tenant_id', event.target.value)} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA]"><option value="">Selecione um tenant</option>{tenants.map(tenant => { const value = String(tenant.tenant_code || tenant.id || ''); return <option key={value} value={value}>{tenant.tenant_name || tenant.name || value}</option>; })}</select></label>}
    <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">E-mail *</span><input type="email" value={form.email} onChange={event => update('email', event.target.value)} disabled={isEdit} required autoComplete="username" placeholder="usuario@empresa.com.br" className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA] disabled:cursor-not-allowed disabled:opacity-60" /></label>
    <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Nome completo</span><input value={form.full_name} onChange={event => update('full_name', event.target.value)} autoComplete="name" placeholder="Nome do usuário" className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA]" /></label>
    <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Perfil {isEdit ? '(opcional)' : ''}</span><select value={form.role_code} onChange={event => update('role_code', event.target.value)} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA]"><option value="">{isEdit ? 'Manter perfil atual' : 'Usar perfil padrão do tenant'}</option>{roles.map(role => <option key={role.id || role.role_code} value={role.role_code}>{role.role_name || role.role_code}</option>)}</select></label>
    <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">{isEdit ? 'Nova senha (opcional)' : 'Senha *'}</span><input type="password" value={form.password} onChange={event => update('password', event.target.value)} required={!isEdit} autoComplete={isEdit ? 'new-password' : 'new-password'} placeholder={isEdit ? 'Deixe em branco para manter' : 'Informe uma senha temporária'} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA]" /></label>
    {error && <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    <div className="flex justify-end gap-2 border-t border-[#1E2A3D] pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-[#2B3850] px-4 py-2 text-sm text-[#CBD5E1] transition hover:bg-[#1E2535] hover:text-white">Cancelar</button><button type="submit" disabled={saving || (!isEdit && !tenants.length)} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar usuário'}</button></div>
  </form></div></div>;
}

const ROLE_LABELS = { admin: 'Administrador', analyst: 'Analista', user: 'Usuário', viewer: 'Visualizador' };
const ROLE_VARIANTS = { admin: 'red', analyst: 'yellow', user: 'blue', viewer: 'default' };

export default function AgentUsers() {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/admin/users');
      setUsers(listFrom(response.data, ['users', 'items']));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  const loadScope = async () => {
    setScopeLoading(true);
    try {
      const [tenantResponse, roleResponse] = await Promise.all([api.get('/api/tenants'), api.get('/api/admin/roles')]);
      setTenants(listFrom(tenantResponse.data, ['tenants', 'items']));
      setRoles(listFrom(roleResponse.data, ['roles', 'items']));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar o escopo de tenants e perfis.');
    } finally {
      setScopeLoading(false);
    }
  };

  useEffect(() => { load(); loadScope(); }, []);

  const remove = async user => {
    if (!window.confirm(`Excluir o usuário ${user.email || user.full_name || user.id}?`)) return;
    setError('');
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      setNotice('Usuário excluído com sucesso.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível excluir o usuário.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID', render: value => <span className="font-mono text-xs text-[#64748B]">{String(value || '').slice(0, 8) || '—'}</span> },
    { key: 'email', label: 'Usuário', render: (value, row) => <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1565C0]/15 text-[#60A5FA]"><UserRound className="h-4 w-4" /></div><div><div className="text-sm font-medium text-white">{value || 'E-mail não informado'}</div><div className="text-xs text-[#64748B]">{row.full_name || 'Nome não informado'}</div></div></div> },
    { key: 'tenant_id', label: 'Tenant', render: value => <Badge variant="default">{value || 'Não informado'}</Badge> },
    { key: 'role_code', label: 'Perfil', render: value => <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#64748B]" /><Badge variant={ROLE_VARIANTS[value] || 'default'}>{ROLE_LABELS[value] || value || 'Não informado'}</Badge></div> },
    { key: 'status', label: 'Status', render: value => <Badge variant={value === 'active' || value === 'ativo' ? 'green' : 'yellow'}>{value === 'active' || value === 'ativo' ? 'Ativo' : value || 'Não informado'}</Badge> },
    { key: 'created_at', label: 'Criado em', render: value => <span className="text-xs text-[#94A3B8]">{value ? new Date(value).toLocaleDateString('pt-BR') : '—'}</span> },
    { key: 'id', label: 'Ações', render: (_, row) => <div className="flex items-center gap-1"><button type="button" onClick={() => setModal(row)} title="Editar usuário" className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#1565C0]/10 hover:text-[#60A5FA]"><Edit2 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => remove(row)} title="Excluir usuário" className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-red-400/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></div> },
  ];

  return <div className="space-y-6"><PageHeader title="Usuários do agente" description="Gerencie identidades, perfis e vínculo de tenant sem usar identificadores padrão." actions={<><button type="button" onClick={() => { load(); loadScope(); }} className="rounded-lg border border-[#2B3850] p-2 text-[#94A3B8] transition hover:bg-[#1E2535] hover:text-white" title="Atualizar"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={() => setModal('new')} disabled={scopeLoading || !tenants.length} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Novo usuário</button></>} />
    {error && <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {notice && <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
    {loading ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[#1E2A3D] bg-[#161B27]"><RefreshCw className="h-6 w-6 animate-spin text-[#60A5FA]" /></div> : <DataTable columns={columns} data={users} emptyMessage="Nenhum usuário cadastrado para os tenants disponíveis." />}
    {modal && <UserModal user={modal === 'new' ? null : modal} tenants={tenants} roles={roles} onClose={() => setModal(null)} onSaved={() => { setModal(null); setNotice('Usuário salvo com sucesso.'); load(); }} />}
  </div>;
}

import { useState } from 'react';
import {
  Plus, RefreshCw, Edit2, Globe, X, Save, Loader2,
  Building2, ShieldCheck, AlertTriangle, Bot, Thermometer, Server
} from 'lucide-react';
import { useApi, apiCall } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';

// Campos padrão alinhados ao schema real da tabela `tenant` e conexão isolada
const EMPTY = {
  id:                     '',           // slug único — obrigatório pelo backend
  tenant_code:            '',
  tenant_name:            '',
  name:                   '',
  environment_code:       '',
  protheus_rest_url:      '',
  protheus_user:          '',
  protheus_rest_password: '',
  auth_mode:              'oauth',
  protheus_webapp_url:    '',
  system_prompt:          '',
  temperature:            0.2,
  plan_code:              '',
  status:                 'active',
  cnpj:                   '',
  licenca_uso:            '',
};

// Converte qualquer string em slug válido (minúsculas, só a-z 0-9 _ -)
function toSlug(v) {
  return v
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function F({ label, name, form, set, type = 'text', placeholder = '', mono = false, span = false, readOnly = false, autoComplete = 'off' }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={form[name] ?? ''}
        onChange={e => !readOnly && set(p => ({ ...p, [name]: e.target.value }))}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className={`w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm
          placeholder-[#8892A4]/40 focus:outline-none focus:border-[#2196F3] focus:ring-1
          focus:ring-[#2196F3]/20 transition-all ${mono ? 'font-mono' : ''}
          ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

function Sel({ label, name, form, set, options }) {
  return (
    <div>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <select
        value={form[name] || ''}
        onChange={e => set(p => ({ ...p, [name]: e.target.value }))}
        className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm
          focus:outline-none focus:border-[#2196F3] transition-all"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SectionDivider({ children }) {
  return (
    <div className="md:col-span-2 flex items-center gap-3 pt-2">
      <span className="text-[#8892A4] text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#1E2535]" />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function TenantModal({ tenant, onClose, onSaved }) {
  const isEdit = !!tenant?.id;
  const [form, setForm] = useState(
    isEdit
      ? {
          ...tenant,
          environment_code: tenant.environment_code || tenant.connection?.environment_code || '',
          protheus_rest_url: tenant.protheus_rest_url || tenant.connection?.base_rest_url || '',
          protheus_user: tenant.protheus_user || tenant.connection?.protheus_username || '',
          auth_mode: tenant.auth_mode || tenant.connection?.auth_mode || 'oauth',
          protheus_rest_password: '',
        }
      : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Ao digitar tenant_code, deriva o id automaticamente (somente no modo criação)
  const handleTenantCode = (e) => {
    const raw = e.target.value;
    setForm(p => ({
      ...p,
      tenant_code: raw,
      ...(!isEdit ? { id: toSlug(raw) } : {}),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');

    const payload = {
      id: form.id,
      name: form.name || form.tenant_name || form.id,
      tenant_code: form.tenant_code || form.id,
      tenant_name: form.tenant_name || form.name || form.id,
      cnpj: form.cnpj || null,
      status: form.status || 'active',
      plan_code: form.plan_code || null,
      licenca_uso: form.licenca_uso || null,
      protheus_webapp_url: form.protheus_webapp_url || null,
      system_prompt: form.system_prompt || null,
      temperature: form.temperature,
      connection: {
        environment_code: String(form.environment_code || '').trim(),
        base_rest_url: String(form.protheus_rest_url || '').trim(),
        auth_mode: form.auth_mode || 'oauth',
        protheus_username: String(form.protheus_user || '').trim(),
      }
    };

    const restPassword = String(form.protheus_rest_password || '').trim();
    if (restPassword) {
      payload.connection.protheus_password = restPassword;
    }

    try {
      if (isEdit) await apiCall(`/api/tenants/${form.id}`, 'PUT', payload);
      else        await apiCall('/api/tenants/', 'POST', payload);
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (props) => <F form={form} set={setForm} {...props} />;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto z-50 py-8 px-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2535]">
          <div>
            <h2 className="text-white font-semibold">{isEdit ? 'Editar Tenant' : 'Novo Tenant'}</h2>
            {isEdit && (
              <p className="text-[#8892A4] text-xs mt-0.5 font-mono">
                ID: {form.id}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={save} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Identificação ── */}
            <SectionDivider>Identificação</SectionDivider>

            {/* tenant_code */}
            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                Código (tenant_code) *
              </label>
              <input
                type="text"
                value={form.tenant_code}
                onChange={handleTenantCode}
                placeholder="rodol_prod"
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5
                  text-white text-sm font-mono placeholder-[#8892A4]/40
                  focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/20 transition-all"
                required
              />
            </div>

            {/* ID (slug) — editável manualmente se necessário, readonly no edit */}
            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                ID (slug único) {!isEdit && <span className="text-[#2196F3] ml-1">— auto</span>}
              </label>
              <input
                type="text"
                value={form.id}
                onChange={e => !isEdit && setForm(p => ({ ...p, id: toSlug(e.target.value) }))}
                placeholder="rodol_prod"
                readOnly={isEdit}
                className={`w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5
                  text-white text-sm font-mono placeholder-[#8892A4]/40
                  focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/20 transition-all
                  ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            
            {f({ label: 'CNPJ', name: 'cnpj', placeholder: '00.000.000/0001-00' })}
            {f({ label: 'Nome de Exibição (name)', name: 'name', placeholder: 'Rodol Ltda' })}
            {f({ label: 'Nome Interno (tenant_name)', name: 'tenant_name', placeholder: 'rodol_prod' })}

            {/* ── Conexão Protheus ── */}
            <SectionDivider>Conexão Protheus</SectionDivider>
            {f({ label: 'Ambiente Protheus (environment_code) *', name: 'environment_code', placeholder: 'c8te0u_prod', mono: true, span: true })}
            {f({ label: 'URL REST Protheus', name: 'protheus_rest_url', placeholder: 'https://rodolltda...:10707/rest', mono: true, span: true })}
            {f({ label: 'URL WebApp Protheus', name: 'protheus_webapp_url', placeholder: 'https://rodolltda...:10703/webapp/index.html', mono: true, span: true })}
            {f({ label: 'Usuário REST (protheus_username)', name: 'protheus_user', placeholder: 'admin' })}
            
            {/* Campo Exclusivo de Senha REST (Isolado de credenciais do painel) */}
            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                {isEdit ? 'Senha REST (em branco = manter)' : 'Senha REST Protheus'}
              </label>
              <input
                type="password"
                name="protheus_rest_password"
                value={form.protheus_rest_password ?? ''}
                onChange={e => setForm(p => ({ ...p, protheus_rest_password: e.target.value }))}
                placeholder={isEdit ? '••••••••' : 'Senha do usuário REST'}
                autoComplete="new-password"
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm
                  placeholder-[#8892A4]/40 focus:outline-none focus:border-[#2196F3] focus:ring-1
                  focus:ring-[#2196F3]/20 transition-all font-mono"
              />
            </div>

            <Sel
              label="Modo de Autenticação (auth_mode)"
              name="auth_mode"
              form={form}
              set={setForm}
              options={[
                { value: 'oauth',  label: 'OAuth 2.0 (Recomendado)' },
                { value: 'basic',  label: 'Basic Auth (usuário + senha)' },
                { value: 'token',  label: 'Bearer Token' },
              ]}
            />

            {/* ── Comportamento do Agente ── */}
            <SectionDivider>Comportamento do Agente</SectionDivider>
            <div className="md:col-span-2">
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Licença de Uso</label>
              <textarea
                value={form.licenca_uso || ''}
                onChange={e => setForm({ ...form, licenca_uso: e.target.value })}
                placeholder="Insira a chave de licença ou token gerado..."
                rows={2}
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all resize-y font-mono placeholder:font-sans"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                System Prompt
              </label>
              <textarea
                value={form.system_prompt || ''}
                onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
                rows={3}
                placeholder="Você é um assistente Protheus para a empresa X. Responda sempre em português..."
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm
                  resize-none placeholder-[#8892A4]/40 focus:outline-none focus:border-[#2196F3] transition-all"
              />
            </div>
            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                Temperature ({form.temperature ?? 0.2})
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={form.temperature ?? 0.2}
                onChange={e => setForm(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-[#2196F3]"
              />
              <div className="flex justify-between text-[10px] text-[#8892A4] mt-1">
                <span>0 — Preciso</span>
                <span>1 — Criativo</span>
              </div>
            </div>

            {/* ── Plano & Status ── */}
            <SectionDivider>Plano & Status</SectionDivider>
            {f({ label: 'Plano (plan_code)', name: 'plan_code', placeholder: 'pro' })}
            <Sel
              label="Status"
              name="status"
              form={form}
              set={setForm}
              options={[
                { value: 'active',    label: 'Ativo' },
                { value: 'inactive',  label: 'Inativo' },
                { value: 'suspended', label: 'Suspenso' },
              ]}
            />

            {/* Timestamps */}
            {isEdit && (
              <>
                <SectionDivider>Auditoria</SectionDivider>
                <div>
                  <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Criado em</label>
                  <div className="bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-[#8892A4] text-sm font-mono">
                    {form.created_at ? new Date(form.created_at).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Atualizado em</label>
                  <div className="bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-[#8892A4] text-sm font-mono">
                    {form.updated_at ? new Date(form.updated_at).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          {err && (
            <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#1E2535]">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-[#8892A4] hover:text-white border border-[#1E2535] hover:border-[#2196F3]/40 rounded-lg transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white font-semibold rounded-lg disabled:opacity-50 transition-all shadow-lg shadow-[#1565C0]/20">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const statusVariant = { active: 'green', inactive: 'default', suspended: 'red' };
const statusLabel   = { active: 'Ativo', inactive: 'Inativo', suspended: 'Suspenso' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Tenants() {
  const { data, loading, refetch } = useApi('/api/tenants/');
  const [modal, setModal] = useState(null);

  const tenants   = Array.isArray(data) ? data : (data?.items ?? data?.tenants ?? []);
  const total     = tenants.length;
  const active    = tenants.filter(t => t.status === 'active').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;

  const columns = [
    {
      key: 'tenant_code', label: 'Código',
      render: v => <span className="font-mono text-white text-xs bg-[#0F1117] px-2 py-0.5 rounded border border-[#1E2535]">{v || '—'}</span>
    },
    {
      key: 'name', label: 'Nome',
      render: (v, row) => (
        <div>
          <div className="text-white text-sm font-medium">{v || row.tenant_name || '—'}</div>
          {row.tenant_name && v && row.tenant_name !== v && (
            <div className="text-[#8892A4] text-xs font-mono">{row.tenant_name}</div>
          )}
        </div>
      )
    },
    {
      key: 'environment_code', label: 'Ambiente',
      render: (v, row) => {
        const env = v || row.connection?.environment_code;
        return env ? (
          <span className="flex items-center gap-1 text-emerald-400 text-xs font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <Server className="w-3 h-3 shrink-0" />
            {env}
          </span>
        ) : <span className="text-[#8892A4] text-xs">—</span>;
      }
    },
    {
      key: 'protheus_rest_url', label: 'URL REST',
      render: (v, row) => {
        const url = v || row.connection?.base_rest_url;
        return url ? (
          <span className="flex items-center gap-1 text-[#2196F3] text-xs font-mono">
            <Globe className="w-3 h-3 shrink-0" />
            {url.length > 35 ? url.slice(0, 35) + '…' : url}
          </span>
        ) : <span className="text-[#8892A4] text-xs">—</span>;
      }
    },
    {
      key: 'auth_mode', label: 'Auth',
      render: (v, row) => {
        const auth = v || row.connection?.auth_mode || 'oauth';
        return <span className="text-[10px] bg-[#0F1117] border border-[#1E2535] text-[#8892A4] px-2 py-0.5 rounded font-mono uppercase">{auth}</span>;
      }
    },
    {
      key: 'plan_code', label: 'Plano',
      render: v => v ? <Badge variant="blue">{v}</Badge> : '—'
    },
    {
      key: 'status', label: 'Status',
      render: v => <Badge variant={statusVariant[v] || 'default'}>{statusLabel[v] || v}</Badge>
    },
    {
      key: 'id', label: '',
      render: (_, row) => (
        <button onClick={() => setModal(row)}
          className="p-1.5 text-[#8892A4] hover:text-[#2196F3] hover:bg-[#1565C0]/10 rounded-md transition-all" title="Editar Tenant">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Gerencie os tenants e suas credenciais de conexão Protheus REST."
        actions={
          <>
            <button onClick={refetch}
              className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setModal('new')}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-[#1565C0]/20">
              <Plus className="w-4 h-4" /> Novo Tenant
            </button>
          </>
        }
      />

      {/* KPI mini */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total',      value: total,     icon: Building2,     bg: 'bg-[#1565C0]/15',    ring: 'ring-[#1565C0]/30',    txt: 'text-[#60A5FA]' },
          { label: 'Ativos',    value: active,    icon: ShieldCheck,   bg: 'bg-emerald-500/15',  ring: 'ring-emerald-500/30',  txt: 'text-emerald-400' },
          { label: 'Suspensos', value: suspended, icon: AlertTriangle, bg: 'bg-amber-500/15',    ring: 'ring-amber-500/30',    txt: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, bg, ring, txt }) => (
          <div key={label} className="bg-[#161B27] border border-[#1E2535] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 ${bg} ring-1 ${ring} rounded-lg flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${txt}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{loading ? '—' : value}</div>
              <div className="text-[#8892A4] text-xs">{label}</div>
            </div>
          </div>
        ))}
      </div>

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

import os

content = """import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { Plus, Edit2, RefreshCw, Building2, ShieldCheck, AlertTriangle, Save, Loader2, Server, Database, Key } from 'lucide-react';

const EMPTY = {
  tenant_code: '',
  name: '',
  status: 'ACTIVE',
  plan_code: '',
  schema_name: '',
};

function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="h-px bg-gradient-to-r from-transparent via-[#1E2535] to-transparent flex-1" />
      <span className="text-xs font-semibold text-[#8892A4] uppercase tracking-widest">{children}</span>
      <div className="h-px bg-gradient-to-r from-[#1E2535] via-[#1E2535] to-transparent flex-1" />
    </div>
  );
}

function Input({ label, name, form, set, required, placeholder, disabled, type="text" }) {
  return (
    <div>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#2196F3]">*</span>}
      </label>
      <input
        type={type}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={form[name] || ''}
        onChange={e => set(p => ({ ...p, [name]: e.target.value }))}
        className="w-full bg-[#0F1117] border border-[#1E2535] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/50 transition-all disabled:opacity-50"
      />
    </div>
  );
}

function Sel({ label, name, form, set, options }) {
  return (
    <div>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={form[name] || ''}
        onChange={e => set(p => ({ ...p, [name]: e.target.value }))}
        className="w-full bg-[#0F1117] border border-[#1E2535] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/50 transition-all appearance-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TenantModal({ tenant, onClose, onSaved }) {
  const isEdit = !!tenant?.id;
  const [form, setForm] = useState(isEdit ? { ...tenant } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState('identificacao');

  const handleTenantCode = (e) => {
    const raw = e.target.value;
    setForm(p => ({
      ...p,
      tenant_code: raw,
      schema_name: p.schema_name || raw.toLowerCase().replace(/[^a-z0-9_]/g, ''),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: form.name,
        tenant_code: form.tenant_code,
        status: form.status,
        plan_code: form.plan_code
      };
      if (isEdit) {
        await api.put(`/api/tenants/${tenant.id}`, payload);
      } else {
        await api.post('/api/tenants', payload);
      }
      onSaved();
    } catch (error) {
      setErr(error.response?.data?.detail || error.message || 'Erro ao salvar tenant.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'identificacao', label: 'Identificação' },
    { id: 'contrato', label: 'Contrato e Módulos' },
    { id: 'ambientes', label: 'Ambientes' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1117]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#1E2535] flex justify-between items-center bg-[#1A202C]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#2196F3]" />
            {isEdit ? 'Editar Tenant' : 'Novo Tenant'}
          </h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white transition-colors">&times;</button>
        </div>

        <div className="flex border-b border-[#1E2535] bg-[#0F1117]">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-6 py-3 text-sm font-medium transition-all ${activeTab === t.id ? 'text-[#2196F3] border-b-2 border-[#2196F3] bg-[#1565C0]/10' : 'text-[#8892A4] hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1">
          {activeTab === 'identificacao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                    Tenant Code <span className="text-[#2196F3]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEdit}
                    value={form.tenant_code || ''}
                    onChange={handleTenantCode}
                    className="w-full bg-[#0F1117] border border-[#1E2535] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/50 transition-all disabled:opacity-50"
                  />
                </div>
                <Input label="Schema Name" name="schema_name" form={form} set={setForm} disabled={true} />
              </div>
              <Input label="Nome da Empresa" name="name" form={form} set={setForm} required />
              
              <div className="grid grid-cols-2 gap-4">
                <Sel
                  label="Status"
                  name="status"
                  form={form}
                  set={setForm}
                  options={[
                    { value: 'ACTIVE',    label: 'Ativo' },
                    { value: 'PENDING',  label: 'Pendente' },
                    { value: 'SUSPENDED', label: 'Suspenso' },
                    { value: 'DECOMMISSIONED', label: 'Desativado' },
                  ]}
                />
              </div>

              {isEdit && (
                <>
                  <SectionDivider>Auditoria</SectionDivider>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Criado em</label>
                      <div className="bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-[#8892A4] text-sm font-mono">
                        {form.created_at ? new Date(form.created_at).toLocaleString('pt-BR') : '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Atualizado em</label>
                      <div className="bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-[#8892A4] text-sm font-mono">
                        {form.updated_at ? new Date(form.updated_at).toLocaleString('pt-BR') : '-'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'contrato' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#1565C0]/10 border border-[#1565C0]/30 rounded-lg text-[#60A5FA] text-sm">
                A gestão completa de contratos e módulos agora é realizada centralmente pela plataforma, vinculando o Tenant ao Catálogo Global Protheus.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Plano / Contract Code" name="plan_code" form={form} set={setForm} />
                <Input label="Limite de Consultas (Mês)" name="queries_limit" form={form} set={setForm} disabled placeholder="Ilimitado" />
              </div>
              <SectionDivider>Módulos Ativados</SectionDivider>
              <div className="grid grid-cols-2 gap-2">
                 <div className="flex items-center gap-2 p-2 bg-[#0F1117] border border-[#1E2535] rounded-md">
                   <input type="checkbox" checked readOnly className="accent-[#2196F3]" />
                   <span className="text-sm text-white">SIGAFIN - Financeiro</span>
                 </div>
                 <div className="flex items-center gap-2 p-2 bg-[#0F1117] border border-[#1E2535] rounded-md">
                   <input type="checkbox" checked readOnly className="accent-[#2196F3]" />
                   <span className="text-sm text-white">SIGAFAT - Faturamento</span>
                 </div>
                 <div className="flex items-center gap-2 p-2 bg-[#0F1117] border border-[#1E2535] rounded-md">
                   <input type="checkbox" readOnly className="accent-[#2196F3]" />
                   <span className="text-sm text-[#8892A4]">SIGACOM - Compras</span>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'ambientes' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="text-emerald-400 font-semibold text-sm">Produção</h4>
                  <p className="text-[#8892A4] text-xs font-mono mt-1">https://protheus.cliente.com.br/rest</p>
                </div>
                <Badge variant="green">Online</Badge>
              </div>
              <button type="button" className="w-full py-3 border border-dashed border-[#1E2535] rounded-lg text-[#8892A4] hover:text-white hover:border-[#2196F3]/50 transition-all text-sm flex justify-center items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar Ambiente (Homologação)
              </button>
            </div>
          )}

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
            <button type="submit" disabled={saving || activeTab !== 'identificacao'}
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

const statusVariant = { ACTIVE: 'green', PENDING: 'blue', SUSPENDED: 'red', DECOMMISSIONED: 'default' };
const statusLabel   = { ACTIVE: 'Ativo', PENDING: 'Pendente', SUSPENDED: 'Suspenso', DECOMMISSIONED: 'Desativado' };

export default function Tenants() {
  const { data, loading, refetch } = useApi('/api/tenants/');
  const [modal, setModal] = useState(null);

  const tenants   = Array.isArray(data) ? data : (data?.items ?? data?.tenants ?? []);
  const total     = tenants.length;
  const active    = tenants.filter(t => t.status === 'ACTIVE').length;
  const suspended = tenants.filter(t => t.status === 'SUSPENDED').length;

  const columns = [
    {
      key: 'tenant_code', label: 'Código',
      render: v => <span className="font-mono text-white text-xs bg-[#0F1117] px-2 py-0.5 rounded border border-[#1E2535]">{v || '-'}</span>
    },
    {
      key: 'name', label: 'Nome',
      render: (v, row) => (
        <div>
          <div className="text-white text-sm font-medium">{v || row.tenant_name || '-'}</div>
          {row.tenant_name && v && row.tenant_name !== v && (
            <div className="text-[#8892A4] text-[10px] font-mono">{row.tenant_name}</div>
          )}
        </div>
      )
    },
    {
      key: 'schema_name', label: 'Schema DB',
      render: v => v ? (
        <span className="flex items-center gap-1 text-[#2196F3] text-xs font-mono">
          <Database className="w-3 h-3 shrink-0" />
          {v}
        </span>
      ) : <span className="text-[#8892A4] text-xs">-</span>
    },
    {
      key: 'plan_code', label: 'Plano',
      render: v => v ? <Badge variant="blue">{v}</Badge> : '-'
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
        title="Tenants (Assinantes)"
        description="Gerencie as assinaturas e provisionamento dos Tenants no Centro de Governança."
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
              <div className="text-xl font-bold text-white">{loading ? '-' : value}</div>
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
"""

with open('admin-frontend/src/pages/Tenants.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Tenants.jsx rewritten")

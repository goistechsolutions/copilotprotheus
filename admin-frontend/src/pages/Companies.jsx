import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { Search, Plus, Edit2, Building, Trash2, ChevronRight, Loader2, Save, ArrowRight } from 'lucide-react';
import { useApi } from '../hooks/useApi';

const EMPTY = {
  company_code: '',
  branch_code: '',
  legal_name: '',
  tax_id: '',
  status: 'ACTIVE'
};

function CompanyModal({ company, isNew, selectedTenant, onClose, onSaved }) {
  const [form, setForm] = useState(isNew ? { ...EMPTY } : {
    company_code: company.protheus_empresa || company.company_code || '',
    branch_code: company.protheus_filial || company.branch_code || '',
    legal_name: company.razao_social || company.legal_name || '',
    tax_id: company.cnpj || company.tax_id || '',
    status: company.status || 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const change = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const f = ({ label, name, required, placeholder }) => (
    <div>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#2196F3]">*</span>}
      </label>
      <input
        type="text" required={required} placeholder={placeholder}
        value={form[name] || ''} onChange={e => change(name, e.target.value)}
        className="w-full bg-[#0F1117] border border-[#1E2535] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/50 transition-all"
      />
    </div>
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
        tenant_id: selectedTenant,
        ...form
      };
      
      if (isNew) {
        await axios.post('/api/companies', payload);
      } else {
        await axios.put(`/api/companies/${company.id}`, payload);
      }
      onSaved();
    } catch (error) {
      setErr(error.response?.data?.detail || error.message || 'Erro ao salvar empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1117]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="p-5 border-b border-[#1E2535] flex justify-between items-center bg-[#1A202C]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-[#2196F3]" />
            {isNew ? 'Nova Empresa/Filial' : 'Editar Empresa/Filial'}
          </h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white transition-colors">&times;</button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto">
          <div className="space-y-4">
            {f({ label: 'Razão Social', name: 'legal_name', required: true })}
            {f({ label: 'CNPJ (Tax ID)', name: 'tax_id' })}

            <div className="grid grid-cols-2 gap-4">
              {f({ label: 'Empresa Protheus (Ex: 01)', name: 'company_code', required: true })}
              {f({ label: 'Filial Protheus (Ex: 0101)', name: 'branch_code', required: true })}
            </div>

            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={form.status || 'ACTIVE'}
                onChange={e => change('status', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              >
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
                <option value="SUSPENDED">Suspensa</option>
              </select>
            </div>
          </div>

          {err && (
            <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{err}</p>
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

export default function Companies() {
  const navigate = useNavigate();
  const { data: tenantsData, loading: loadingTenants } = useApi('/api/tenants');
  const [companies, setCompanies] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const tenants = Array.isArray(tenantsData) ? tenantsData : (tenantsData?.items ?? tenantsData?.tenants ?? []);

  useEffect(() => {
    if (tenants.length > 0 && !selectedTenant) {
      setSelectedTenant(tenants[0].tenant_code);
    }
  }, [tenants, selectedTenant]);

  const fetchCompanies = async () => {
    if (!selectedTenant) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/companies?tenant_id=${encodeURIComponent(selectedTenant)}`);
      setCompanies(Array.isArray(res.data) ? res.data : res.data?.items ?? []);
    } catch (err) {
      console.error("Erro ao carregar companies do tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [selectedTenant]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir esta empresa do escopo?')) return;
    try {
      await axios.delete(`/api/companies/${id}?tenant_id=${encodeURIComponent(selectedTenant)}`);
      fetchCompanies();
    } catch (err) {
      alert("Erro ao excluir: " + (err.response?.data?.detail || err.message));
    }
  };

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const name = (c.razao_social || c.legal_name || '').toLowerCase();
    const cnpj = (c.cnpj || c.tax_id || '').toLowerCase();
    return !q || name.includes(q) || cnpj.includes(q);
  });

  const initials = (c) => (c.razao_social || c.legal_name || 'CP').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader
        title="Empresas por Tenant"
        description="Gerencie as empresas e filiais importadas dentro do escopo (schema) de cada Tenant."
        actions={
          <button onClick={() => setModal('new')} disabled={!selectedTenant}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-[#1565C0]/20 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Nova Empresa/Filial
          </button>
        }
      />

      {/* Tenant Selector */}
      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white text-sm font-semibold mb-1">Selecionar Tenant</h3>
          <p className="text-[#8892A4] text-xs">A lista de empresas é restrita ao schema do tenant selecionado.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            disabled={loadingTenants}
            className="w-full sm:w-64 bg-[#0F1117] border border-[#1E2535] text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#2196F3] transition-all"
          >
            <option value="" disabled>Selecione um tenant...</option>
            {tenants.map(t => (
              <option key={t.tenant_code} value={t.tenant_code}>{t.tenant_name || t.tenant_code}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empresa ou CNPJ..."
          className="w-full bg-[#161B27] border border-[#1E2535] rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] transition-all"
        />
      </div>

      {loading || loadingTenants ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedTenant ? (
         <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#1E2535] rounded-xl bg-[#161B27]/50">
           <p className="text-[#8892A4] text-sm">Selecione um tenant acima para visualizar as empresas.</p>
         </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const legalName = c.razao_social || c.legal_name || '-';
            const taxId = c.cnpj || c.tax_id;
            const emp = c.protheus_empresa || c.company_code || '-';
            const fil = c.protheus_filial || c.branch_code || '-';
            const isActive = (c.status || '').toUpperCase() === 'ACTIVE' || c.status === 'ativa';

            return (
              <div key={c.id}
                onClick={() => navigate(`/companies/${c.id}`)}
                className="group flex items-center justify-between bg-[#161B27] border border-[#1E2535] hover:border-[#2196F3]/40 rounded-xl px-4 py-3 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1565C0]/30 to-[#2196F3]/20 border border-[#1565C0]/30 flex items-center justify-center shrink-0">
                    <span className="text-[#60A5FA] text-xs font-bold">{initials(c)}</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium group-hover:text-[#60A5FA] transition-colors">{legalName}</div>
                    <div className="text-[#8892A4] text-xs flex items-center gap-2">
                      <span>Emp: <span className="font-mono text-white/70">{emp}</span></span>
                      <span>Filial: <span className="font-mono text-white/70">{fil}</span></span>
                      {taxId && <span>CNPJ: <span className="font-mono text-white/70">{taxId}</span></span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-[#1E2535] text-[#8892A4] border-[#1E2535]'
                  }`}>
                    {isActive ? 'Ativa' : 'Inativa'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setModal(c); }}
                    className="p-1.5 text-[#8892A4] hover:text-[#2196F3] hover:bg-[#1565C0]/10 rounded-md transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => handleDelete(e, c.id)}
                    className="p-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-[#8892A4] group-hover:text-[#2196F3] transition-colors" />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-[#161B27] border border-[#1E2535] rounded-full flex items-center justify-center mb-4">
                <Building className="w-7 h-7 text-[#1E2535]" />
              </div>
              <p className="text-white text-sm font-medium mb-1">Nenhuma empresa encontrada</p>
              <p className="text-[#8892A4] text-xs max-w-xs">
                {search ? 'Tente outro termo de busca.' : 'Clique em "Nova Empresa" para adicionar no tenant atual.'}
              </p>
            </div>
          )}
        </div>
      )}

      {modal && (
        <CompanyModal
          company={modal === 'new' ? null : modal}
          isNew={modal === 'new'}
          selectedTenant={selectedTenant}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchCompanies(); }}
        />
      )}
    </div>
  );
}

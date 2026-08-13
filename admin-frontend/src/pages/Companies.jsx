import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import {
  Building, Plus, Edit2, Trash2, Save, X,
  Search, ChevronRight, Globe, Lock, Loader2, Key
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const EMPTY = {
  cnpj:'', razao_social:'', ie:'', email:'', telefone:'', endereco:'',
  protheus_grupo:'', protheus_empresa:'', protheus_unidade:'', protheus_filial:'',
  protheus_ambientes:'', protheus_usuario:'', protheus_password:'',
  protheus_rest_url:'', webapp_url:'', status:'ativa',
  tenant_id:''
};

function Field({ label, name, form, onChange, type='text', placeholder='', span=false, mono=false }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type} value={form[name] || ''}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#8892A4]/40 focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/20 transition-all ${
          mono ? 'font-mono' : ''
        }`}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="md:col-span-2 flex items-center gap-3 mt-2">
      <span className="text-[#8892A4] text-[10px] font-bold uppercase tracking-[0.15em]">{children}</span>
      <div className="flex-1 h-px bg-[#1E2535]" />
    </div>
  );
}

function CompanyModal({ company, tenants, onClose, onSaved, isNew }) {
  const [form, setForm] = useState(isNew ? EMPTY : { ...company });
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [err, setErr] = useState('');

  const change = (name, val) => setForm(p => ({ ...p, [name]: val }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      if (isNew) await axios.post('/api/companies', form);
      else       await axios.put(`/api/companies/${form.id}`, form);
      onSaved();
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const generateLicense = async () => {
    if (!form.cnpj) { setErr('Preencha o CNPJ da empresa antes de gerar a licença.'); return; }
    setGenLoading(true); setErr('');
    try {
      const exp = new Date();
      exp.setFullYear(exp.getFullYear() + 5);
  const f = (props) => <Field form={form} onChange={change} {...props} />;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2535]">
          <h2 className="text-white font-semibold">{isNew ? 'Nova Empresa' : 'Editar Empresa'}</h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={save} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <SectionTitle>Dados Cadastrais</SectionTitle>
            {f({ label:'CNPJ', name:'cnpj', placeholder:'00.000.000/0001-00', mono:true })}
            {f({ label:'IE', name:'ie', placeholder:'Inscrição Estadual' })}
            {f({ label:'Razão Social', name:'razao_social', placeholder:'Empresa Ltda', span:true })}
            {f({ label:'E-mail', name:'email', type:'email', placeholder:'contato@empresa.com' })}
            {f({ label:'Telefone', name:'telefone', placeholder:'(11) 99999-9999' })}
            {f({ label:'Endereço', name:'endereco', span:true })}

            <SectionTitle>Configurações Protheus</SectionTitle>
            <div className="md:col-span-2">
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Tenant Vinculado *</label>
              <select
                value={form.tenant_id || ''}
                onChange={e => change('tenant_id', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              >
                <option value="">Selecione um Tenant...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.tenant_code || t.code || t.id}>{t.tenant_name || t.name} ({t.tenant_code || t.code || t.id})</option>
                ))}
              </select>
            </div>
            {f({ label:'Grupo', name:'protheus_grupo', placeholder:'T1', mono:true })}
            {f({ label:'Empresa', name:'protheus_empresa', placeholder:'01', mono:true })}
            {f({ label:'Unidade', name:'protheus_unidade', placeholder:'01', mono:true })}
            {f({ label:'Filial', name:'protheus_filial', placeholder:'0101', mono:true })}
            {f({ label:'Ambientes', name:'protheus_ambientes', placeholder:'producao,hml', mono:true, span:true })}
            {f({ label:'Usuário REST', name:'protheus_usuario', placeholder:'admin' })}
            {f({ label:'Senha REST', name:'protheus_password', type:'password', placeholder: isNew ? 'Obrigatória' : 'Em branco = manter' })}
            {f({ label:'URL REST (API)', name:'protheus_rest_url', placeholder:'http://ip:porta/rest', span:true, mono:true })}
            {f({ label:'URL WebApp', name:'webapp_url', placeholder:'http://ip:porta/webapp', span:true, mono:true })}

            <SectionTitle>Status</SectionTitle>

            <div>
              <label className="block text-[#8892A4] text-[10px] font-semibold uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={form.status || 'ativa'}
                onChange={e => change('status', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              >
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="suspensa">Suspensa</option>
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
              className="flex items-center gap-2 px-5 py-2 text-sm bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white font-semibold rounded-lg disabled:opacity-50 transition-all">
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
  const [companies, setCompanies] = useState([]);
  const [tenants, setTenants]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null); // null | 'new' | company

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const cRes = await axios.get('/api/companies').catch(() => null);
      const tRes = await axios.get('/api/tenants').catch(() => null);
      if (cRes) setCompanies(Array.isArray(cRes.data) ? cRes.data : cRes.data?.items ?? []);
      if (tRes) setTenants(Array.isArray(tRes.data) ? tRes.data : tRes.data?.items ?? []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Excluir esta empresa?')) return;
    try { await axios.delete(`/api/companies/${id}`); fetchData(); } catch {}
  };

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    return !q || c.razao_social?.toLowerCase().includes(q) || c.cnpj?.includes(q);
  });

  const initials = (c) => (c.razao_social || c.name || 'CP').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader
        title="Empresas SaaS"
        description="Empresas conectadas ao ambiente multitenant Protheus."
        actions={
          <button onClick={() => setModal('new')}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#1565C0] to-[#2196F3] text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-[#1565C0]/20">
            <Plus className="w-4 h-4" /> Nova Empresa
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
          className="w-full bg-[#161B27] border border-[#1E2535] rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id}
              onClick={() => navigate(`/companies/${c.id}`)}
              className="group flex items-center justify-between bg-[#161B27] border border-[#1E2535] hover:border-[#2196F3]/40 rounded-xl px-4 py-3 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1565C0]/30 to-[#2196F3]/20 border border-[#1565C0]/30 flex items-center justify-center shrink-0">
                  <span className="text-[#60A5FA] text-xs font-bold">{initials(c)}</span>
                </div>
                <div>
                  <div className="text-white text-sm font-medium group-hover:text-[#60A5FA] transition-colors">{c.razao_social}</div>
                  <div className="text-[#8892A4] text-xs">
                    Grupo: <span className="font-mono">{c.protheus_grupo || '—'}</span>
                    {c.cnpj && <> · CNPJ: <span className="font-mono">{c.cnpj}</span></>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {c.protheus_rest_url && (
                  <span className="hidden sm:flex items-center gap-1 text-[#2196F3] text-xs">
                    <Globe className="w-3 h-3" /> REST
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  c.status === 'ativa'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-[#1E2535] text-[#8892A4] border-[#1E2535]'
                }`}>
                  {c.status === 'ativa' ? 'Ativa' : c.status || 'Inativa'}
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
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-[#161B27] border border-[#1E2535] rounded-full flex items-center justify-center mb-4">
                <Building className="w-7 h-7 text-[#1E2535]" />
              </div>
              <p className="text-white text-sm font-medium mb-1">Nenhuma empresa encontrada</p>
              <p className="text-[#8892A4] text-xs max-w-xs">
                {search ? 'Tente outro termo de busca.' : 'Clique em "Nova Empresa" para começar.'}
              </p>
            </div>
          )}
        </div>
      )}

      {modal && (
        <CompanyModal
          company={modal === 'new' ? null : modal}
          isNew={modal === 'new'}
          tenants={tenants}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}

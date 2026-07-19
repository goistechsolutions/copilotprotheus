import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building, Plus, Edit2, Trash2, Save, X, Search, Filter } from 'lucide-react';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [compRes, tenRes] = await Promise.all([
        axios.get('/api/companies'),
        axios.get('/api/tenants', { auth: { username: 'admin', password: 'admin123' } })
      ]);
      setCompanies(compRes.data || []);
      setTenants(tenRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (comp) => {
    setEditing(comp.id);
    setFormData(comp);
  };

  const handleCreate = () => {
    setEditing('new');
    setFormData({
      cnpj: '',
      razao_social: '',
      protheus_grupo: '',
      tenant_id: '',
      protheus_filial: '',
      protheus_usuario: '',
      protheus_password: '',
      protheus_rest_url: '',
      protheus_webapp_url: '',
      licenca_uso: '',
      status: 'ativa'
    });
  };

  const handleSave = async () => {
    try {
      if (editing === 'new') {
        await axios.post('/api/companies', formData);
      } else {
        await axios.put(`/api/companies/${editing}`, formData);
      }
      setEditing(null);
      fetchData();
    } catch (error) {
      alert("Erro ao salvar: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta empresa?")) {
      try {
        await axios.delete(`/api/companies/${id}`);
        fetchData();
      } catch (error) {
        alert("Erro ao excluir.");
      }
    }
  };

  if (loading) return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Carregando...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Empresas SaaS</h2>
          <p className="text-slate-500">Gerenciamento de empresas (Tenants) conectadas ao ambiente multitenant.</p>
        </div>
        <button onClick={handleCreate} className="bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm shrink-0">
          <Plus size={18} /> Nova Empresa
        </button>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50/50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{editing === 'new' ? 'Nova Empresa' : 'Editar Empresa'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">CNPJ</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Razão Social</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.razao_social || ''} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tenant Vinculado</label>
                <select className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.tenant_id || ''} onChange={e => setFormData({...formData, tenant_id: e.target.value})}>
                  <option value="">Selecione um Tenant...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Grupo Protheus (Legado)</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_grupo || ''} onChange={e => setFormData({...formData, protheus_grupo: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Filial</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_filial || ''} onChange={e => setFormData({...formData, protheus_filial: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Usuário Protheus</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_usuario || ''} onChange={e => setFormData({...formData, protheus_usuario: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Senha Protheus (Nova)</label>
                <input type="password" placeholder={editing === 'new' ? "Obrigatório" : "Deixe em branco para manter a atual"} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_password || ''} onChange={e => setFormData({...formData, protheus_password: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">URL Portal REST</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_rest_url || ''} onChange={e => setFormData({...formData, protheus_rest_url: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Licença de Uso (JWT)</label>
                <textarea className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-mono h-24 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.licenca_uso || ''} onChange={e => setFormData({...formData, licenca_uso: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><Save size={18} /> Salvar</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><X size={18} /> Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou CNPJ..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 md:w-80 transition-all"
              />
            </div>
            <button className="text-slate-500 hover:text-brand-600 p-2 rounded-lg hover:bg-brand-50 transition-colors border border-transparent hover:border-brand-100">
              <Filter size={18} />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">ID / Nome</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">CNPJ</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm border border-brand-100">
                        {c.name ? c.name.substring(0, 2).toUpperCase() : c.razao_social?.substring(0, 2).toUpperCase() || 'CP'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{c.razao_social}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">Tenant: {c.protheus_grupo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 font-mono">
                    {c.cnpj || 'Não informado'}
                  </td>
                  <td className="px-6 py-4">
                    {c.status === 'ativa' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-100">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <Building size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-500 font-medium">Nenhuma empresa cadastrada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

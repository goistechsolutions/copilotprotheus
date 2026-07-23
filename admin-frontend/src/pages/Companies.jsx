import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building, Plus, Edit2, Trash2, Save, X, Search, Filter, ArrowRight, ChevronRight } from 'lucide-react';

export default function Companies() {
  const navigate = useNavigate();
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

  const handleGenerateLicense = async () => {
    if (!formData.cnpj) {
      alert("É necessário preencher o CNPJ para gerar a licença.");
      return;
    }
    if (!confirm("Isso irá gerar uma nova licença JWT para esta empresa válida até 2030. Continuar?")) return;
    
    try {
      const res = await axios.post('/api/license/generate', {
        cnpj: formData.cnpj,
        expiration_date: '2030-12-31',
        plan_level: 'enterprise'
      });
      setFormData({...formData, licenca_uso: res.data.license_token});
      alert("Licença gerada com sucesso! Não se esqueça de Salvar a empresa.");
    } catch (error) {
      alert("Erro ao gerar licença: " + (error.response?.data?.detail || error.message));
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
              <div className="col-span-1 md:col-span-2 text-sm font-semibold text-slate-800 mt-2 mb-1 border-b border-slate-100 pb-2">Dados Cadastrais</div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">CNPJ</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Inscrição Estadual (IE)</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.ie || ''} onChange={e => setFormData({...formData, ie: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Razão Social</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.razao_social || ''} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">E-mail</label>
                <input type="email" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Telefone</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.telefone || ''} onChange={e => setFormData({...formData, telefone: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Endereço Completo</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.endereco || ''} onChange={e => setFormData({...formData, endereco: e.target.value})} />
              </div>

              <div className="col-span-1 md:col-span-2 text-sm font-semibold text-slate-800 mt-4 mb-1 border-b border-slate-100 pb-2">Configurações Protheus & Integração</div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tenant Vinculado (Obrigatório)</label>
                <select className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.tenant_id || ''} onChange={e => setFormData({...formData, tenant_id: e.target.value})}>
                  <option value="">Selecione um Tenant...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Grupo (Legado)</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_grupo || ''} onChange={e => setFormData({...formData, protheus_grupo: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Empresa</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_empresa || ''} onChange={e => setFormData({...formData, protheus_empresa: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Unidade</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_unidade || ''} onChange={e => setFormData({...formData, protheus_unidade: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Filial</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_filial || ''} onChange={e => setFormData({...formData, protheus_filial: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Ambientes (ex: producao,hml)</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_ambientes || ''} onChange={e => setFormData({...formData, protheus_ambientes: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Usuário REST Protheus</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_usuario || ''} onChange={e => setFormData({...formData, protheus_usuario: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Senha REST Protheus</label>
                <input type="password" placeholder={editing === 'new' ? "Obrigatório" : "Deixe em branco p/ manter a atual"} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_password || ''} onChange={e => setFormData({...formData, protheus_password: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">URL Portal REST (API)</label>
                <input type="text" placeholder="http://ip:porta/rest" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_rest_url || ''} onChange={e => setFormData({...formData, protheus_rest_url: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">URL WebApp (Opcional - p/ Atalhos)</label>
                <input type="text" placeholder="http://ip:porta/webapp" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_webapp_url || ''} onChange={e => setFormData({...formData, protheus_webapp_url: e.target.value})} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Licença de Uso (JWT)</label>
                  <button onClick={handleGenerateLicense} className="text-[10px] uppercase font-bold tracking-wider bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-md transition-colors border border-brand-200">
                    Gerar Nova Licença
                  </button>
                </div>
                <textarea className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-mono h-24 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.licenca_uso || ''} onChange={e => setFormData({...formData, licenca_uso: e.target.value})} placeholder="Cole a licença JWT aqui ou clique no botão acima para gerar uma nova..." />
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

        <div className="p-4">
          <div className="flex flex-col space-y-2">
            {companies.map(c => (
              <div 
                key={c.id} 
                onClick={() => navigate(`/companies/${c.id}`)}
                className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-md cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm border border-brand-100 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    {c.name ? c.name.substring(0, 2).toUpperCase() : c.razao_social?.substring(0, 2).toUpperCase() || 'CP'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">{c.razao_social}</h3>
                    <p className="text-sm text-slate-500">Tenant: {c.protheus_grupo} • CNPJ: {c.cnpj || 'Não informado'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {c.status === 'ativa' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                      Inativo
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1 ml-3 border-l border-slate-200 pl-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Editar Empresa"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir Empresa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="text-slate-300 group-hover:text-brand-600 transition-colors ml-1">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </div>
            ))}
            
            {companies.length === 0 && (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Building size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">Nenhuma empresa encontrada</h3>
                <p className="text-slate-500 max-w-sm">
                  Não há empresas cadastradas no momento. Clique no botão "Nova Empresa" acima para criar o primeiro tenant SaaS.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

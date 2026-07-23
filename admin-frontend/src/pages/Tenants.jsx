import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Server, Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react';

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/tenants');
      setTenants(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (t) => {
    setEditing(t.id);
    setFormData(t);
  };

  const handleCreate = () => {
    setEditing('new');
    setFormData({
      id: '',
      name: '',
      protheus_rest_url: '',
      protheus_user: '',
      protheus_password: '',
      auth_mode: 'basic',
      system_prompt: '',
      temperature: 0.7
    });
  };

  const handleSave = async () => {
    try {
      if (editing === 'new') {
        await axios.post('/api/tenants', formData);
      } else {
        await axios.put(`/api/tenants/${editing}`, formData);
      }
      setEditing(null);
      fetchTenants();
    } catch (error) {
      alert("Erro ao salvar: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("ATENÇÃO! Tem certeza que deseja excluir este Tenant? Todos os dados associados poderão ficar inacessíveis.")) {
      try {
        await axios.delete(`/api/tenants/${id}`);
        fetchTenants();
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
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Gerenciamento de Tenants</h2>
          <p className="text-slate-500">Administre os clientes (Tenants), Prompts de Sistema e schemas de banco de dados.</p>
        </div>
        <button onClick={handleCreate} className="bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm shrink-0">
          <Plus size={18} /> Novo Tenant
        </button>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50/50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{editing === 'new' ? 'Novo Tenant' : 'Editar Tenant'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">ID do Tenant (schema)</label>
                <input type="text" disabled={editing !== 'new'} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:bg-slate-100" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="ex: xp_investimentos" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nome de Exibição</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">URL Protheus REST</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_rest_url || ''} onChange={e => setFormData({...formData, protheus_rest_url: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Usuário Protheus</label>
                  <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_user || ''} onChange={e => setFormData({...formData, protheus_user: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Senha (nova)</label>
                  <input type="password" placeholder={editing === 'new' ? '' : '*** (deixe em branco p/ manter)'} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" value={formData.protheus_password || ''} onChange={e => setFormData({...formData, protheus_password: e.target.value})} />
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">System Prompt (Personalidade do IA)</label>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-mono h-32 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                  value={formData.system_prompt || ''} 
                  onChange={e => setFormData({...formData, system_prompt: e.target.value})} 
                  placeholder="Deixe em branco para usar o padrão global..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Temperatura (Criatividade) - {formData.temperature}</label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  className="w-full accent-brand-600" 
                  value={formData.temperature ?? 0.7} 
                  onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})} 
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0.0 (Focado)</span>
                  <span>1.0 (Criativo)</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
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
                placeholder="Buscar tenants..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 md:w-80 transition-all"
              />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">ID / Nome</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">URL Protheus</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Personalização IA</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm border border-purple-100">
                        <Server size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{t.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                    {t.protheus_rest_url ? <span className="text-brand-600 truncate block max-w-xs">{t.protheus_rest_url}</span> : <span className="text-slate-400">Nenhuma URL configurada</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {t.system_prompt ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-max">
                          Prompt Customizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 w-max">
                          Prompt Padrão
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-mono">Temp: {t.temperature}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleEdit(t)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-100">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <Server size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-500 font-medium">Nenhum tenant configurado.</p>
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

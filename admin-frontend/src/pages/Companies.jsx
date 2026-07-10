import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building, Plus, Edit2, Trash2, Save, X } from 'lucide-react';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/api/companies');
      setCompanies(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
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
      protheus_filial: '',
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
      fetchCompanies();
    } catch (error) {
      alert("Erro ao salvar: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta empresa?")) {
      try {
        await axios.delete(`/api/companies/${id}`);
        fetchCompanies();
      } catch (error) {
        alert("Erro ao excluir.");
      }
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Empresas (SaaS)</h2>
          <p className="text-slate-500">Gerencie todos os clientes conectados ao Protheus Copilot.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          <Plus size={18} /> Nova Empresa
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4">{editing === 'new' ? 'Nova Empresa' : 'Editar Empresa'}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">CNPJ</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Razão Social</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.razao_social || ''} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Grupo Protheus / Tenant ID</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.protheus_grupo || ''} onChange={e => setFormData({...formData, protheus_grupo: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Filial</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.protheus_filial || ''} onChange={e => setFormData({...formData, protheus_filial: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">URL Portal REST</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.protheus_rest_url || ''} onChange={e => setFormData({...formData, protheus_rest_url: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">Licença de Uso (JWT)</label>
                <textarea className="w-full p-2 border rounded font-mono text-xs h-20" value={formData.licenca_uso || ''} onChange={e => setFormData({...formData, licenca_uso: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-1 bg-emerald-600 text-white px-4 py-2 rounded font-medium"><Save size={16} /> Salvar</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1 bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium"><X size={16} /> Cancelar</button>
            </div>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">CNPJ</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Razão Social</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Grupo (Tenant)</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Ações</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 text-sm font-mono">{c.cnpj}</td>
                <td className="p-4 text-sm font-medium text-slate-800">{c.razao_social}</td>
                <td className="p-4 text-sm text-slate-600">{c.protheus_grupo}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${c.status === 'ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {c.status?.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => handleEdit(c)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">Nenhuma empresa cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

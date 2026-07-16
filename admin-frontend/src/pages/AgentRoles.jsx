import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Plus, Trash2, Save, X, Edit2, ShieldAlert } from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  "Acessar Dashboards",
  "Acessar Vendas",
  "Acessar Financeiro",
  "Acessar Estoque",
  "Acessar Compras",
  "Modificar Registros",
  "Painel Administrativo",
  "Configurações Globais",
  "Excluir Dados"
];

export default function AgentRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await axios.get('/api/admin/agent-roles', axiosConfig);
      setRoles(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar papéis:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing('new');
    setFormData({
      tenant_id: '',
      name: '',
      permissions: []
    });
  };

  const handleEdit = (role) => {
    setEditing(role.id);
    setFormData({
      tenant_id: role.tenant_id,
      name: role.name,
      permissions: role.permissions || []
    });
  };

  const togglePermission = (perm) => {
    const current = formData.permissions || [];
    if (current.includes(perm)) {
      setFormData({ ...formData, permissions: current.filter(p => p !== perm) });
    } else {
      setFormData({ ...formData, permissions: [...current, perm] });
    }
  };

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.name) {
      alert("Preencha o Tenant ID e o Nome do Cargo.");
      return;
    }
    
    try {
      if (editing === 'new') {
        await axios.post('/api/admin/agent-roles', formData, axiosConfig);
      } else {
        await axios.put(`/api/admin/agent-roles/${editing}`, formData, axiosConfig);
      }
      setEditing(null);
      fetchRoles();
    } catch (error) {
      alert("Erro ao salvar cargo: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja remover este cargo? Usuários vinculados poderão perder acesso ou herdar regras antigas.")) {
      try {
        await axios.delete(`/api/admin/agent-roles/${id}`, axiosConfig);
        fetchRoles();
      } catch (error) {
        alert("Erro ao excluir cargo.");
      }
    }
  };

  if (loading) return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Carregando...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Cargos e Permissões</h2>
          <p className="text-slate-500">Defina os papéis dos usuários para limitar o que o Copilot pode acessar para cada perfil.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Novo Cargo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50/50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={20} className="text-brand-600" /> {editing === 'new' ? 'Cadastrar Novo Cargo' : 'Editar Cargo'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tenant ID (Grupo)</label>
                <input 
                  type="text" 
                  placeholder="Ex: pilot_rodolltda"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                  value={formData.tenant_id} 
                  onChange={e => setFormData({...formData, tenant_id: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nome do Cargo</label>
                <input 
                  type="text" 
                  placeholder="Ex: VENDEDOR, SUPERVISOR, ADMIN"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all uppercase" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Permissões do Cargo</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white border border-slate-200 rounded-xl">
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500/20 transition-all"
                      checked={(formData.permissions || []).includes(perm)}
                      onChange={() => togglePermission(perm)}
                    />
                    <span className="text-sm font-medium text-slate-700">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><Save size={18} /> Salvar Cargo</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><X size={18} /> Cancelar</button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tenant ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Cargo (Papel)</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Permissões</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 font-mono">{r.tenant_id}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                        <ShieldCheck size={14} />
                      </div>
                      {r.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="flex flex-wrap gap-1.5">
                      {(r.permissions || []).map(p => (
                        <span key={p} className="px-2.5 py-1 bg-slate-100 text-slate-600 font-medium border border-slate-200 rounded-md text-xs">{p}</span>
                      ))}
                      {(!r.permissions || r.permissions.length === 0) && <span className="text-slate-400 italic">Sem permissões vinculadas</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => handleEdit(r)} title="Editar Cargo" className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-100">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} title="Excluir Cargo" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <ShieldAlert size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-500 font-medium">Nenhum cargo cadastrado.</p>
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

import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Plus, Trash2, Save, X, Edit2 } from 'lucide-react';

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
  const [editing, setEditing] = useState(null); // 'new' or role.id
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

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Cargos e Permissões</h2>
          <p className="text-slate-500">Defina os papéis dos usuários para limitar o que o Copilot pode acessar para cada perfil.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
        >
          <Plus size={18} /> Novo Cargo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-500" /> {editing === 'new' ? 'Cadastrar Novo Cargo' : 'Editar Cargo'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tenant ID (Grupo)</label>
                <input 
                  type="text" 
                  placeholder="Ex: pilot_rodolltda"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.tenant_id} 
                  onChange={e => setFormData({...formData, tenant_id: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nome do Cargo</label>
                <input 
                  type="text" 
                  placeholder="Ex: VENDEDOR, SUPERVISOR, ADMIN"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-600 mb-2">Permissões do Cargo</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white border border-slate-200 rounded-lg">
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={(formData.permissions || []).includes(perm)}
                      onChange={() => togglePermission(perm)}
                    />
                    <span className="text-sm text-slate-700">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium transition"><Save size={16} /> Salvar Cargo</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium transition"><X size={16} /> Cancelar</button>
            </div>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Tenant ID</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Cargo (Papel)</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Permissões</th>
              <th className="p-4 font-semibold text-slate-600 text-sm w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 text-sm font-medium text-slate-700">{r.tenant_id}</td>
                <td className="p-4 text-sm text-slate-800 font-bold">{r.name}</td>
                <td className="p-4 text-sm text-slate-500">
                  <div className="flex flex-wrap gap-1">
                    {(r.permissions || []).map(p => (
                      <span key={p} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">{p}</span>
                    ))}
                    {(!r.permissions || r.permissions.length === 0) && <span className="text-slate-400 italic">Sem permissões</span>}
                  </div>
                </td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => handleEdit(r)} title="Editar Cargo" className="text-blue-600 hover:bg-blue-100 p-2 rounded transition">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} title="Excluir Cargo" className="text-red-500 hover:bg-red-100 p-2 rounded transition">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr><td colSpan="4" className="p-8 text-center text-slate-500">Nenhum cargo cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

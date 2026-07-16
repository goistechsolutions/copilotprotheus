import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Plus, Trash2, Save, X } from 'lucide-react';

export default function AgentUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/admin/agent-users');
      setUsers(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing(true);
    setFormData({
      tenant_id: '',
      username: '',
      password: ''
    });
  };

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.username || !formData.password) {
      alert("Preencha todos os campos.");
      return;
    }
    
    try {
      await axios.post('/api/admin/agent-users', formData);
      setEditing(false);
      fetchUsers();
    } catch (error) {
      alert("Erro ao criar usuário: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja remover o acesso deste usuário?")) {
      try {
        await axios.delete(`/api/admin/agent-users/${id}`);
        fetchUsers();
      } catch (error) {
        alert("Erro ao excluir usuário.");
      }
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Usuários Copilot</h2>
          <p className="text-slate-500">Gerencie as senhas de acesso do agente para controlar o histórico.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-500" /> Cadastrar Novo Usuário
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                <label className="block text-sm font-medium text-slate-600 mb-1">Usuário Copilot</label>
                <input 
                  type="text" 
                  placeholder="Ex: joao.silva"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Senha (Criptografada na base)</label>
                <input 
                  type="password" 
                  placeholder="***"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium transition"><Save size={16} /> Salvar e Criptografar</button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded font-medium transition"><X size={16} /> Cancelar</button>
            </div>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Tenant ID</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Usuário Copilot</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Papel</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Data de Criação</th>
              <th className="p-4 font-semibold text-slate-600 text-sm w-16">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 text-sm font-medium text-slate-700">{u.tenant_id}</td>
                <td className="p-4 text-sm text-slate-800 font-bold">{u.username}</td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    {u.role?.toUpperCase() || 'USER'}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {new Date(u.created_at).toLocaleString()}
                </td>
                <td className="p-4">
                  <button onClick={() => handleDelete(u.id)} title="Remover Acesso" className="text-red-500 hover:bg-red-100 p-2 rounded transition">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">Nenhum usuário cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

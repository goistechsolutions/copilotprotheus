import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Plus, Trash2, Save, X, Edit2, Users } from 'lucide-react';

export default function AgentUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      const [resUsers, resRoles, resTenants] = await Promise.all([
        axios.get('/api/admin/agent-users', axiosConfig),
        axios.get('/api/admin/agent-roles', axiosConfig),
        axios.get('/api/tenants', axiosConfig)
      ]);
      setUsers(resUsers.data || []);
      setRoles(resRoles.data || []);
      setTenants(resTenants.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing('new');
    setFormData({
      tenant_id: '',
      username: '',
      password: '',
      role: 'USER'
    });
  };

  const handleEdit = (user) => {
    setEditing(user.id);
    setFormData({
      tenant_id: user.tenant_id,
      username: user.username,
      password: '',
      role: user.role || 'USER'
    });
  };

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.username) {
      alert("Preencha o Tenant ID e o Usuário.");
      return;
    }
    if (editing === 'new' && !formData.password) {
      alert("Para um novo usuário a senha é obrigatória.");
      return;
    }
    
    try {
      if (editing === 'new') {
        await axios.post('/api/admin/agent-users', formData, axiosConfig);
      } else {
        await axios.put(`/api/admin/agent-users/${editing}`, formData, axiosConfig);
      }
      setEditing(null);
      fetchUsersAndRoles();
    } catch (error) {
      alert("Erro ao salvar usuário: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja remover o acesso deste usuário?")) {
      try {
        await axios.delete(`/api/admin/agent-users/${id}`, axiosConfig);
        fetchUsersAndRoles();
      } catch (error) {
        alert("Erro ao excluir usuário.");
      }
    }
  };

  if (loading) return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Carregando...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Usuários Copilot</h2>
          <p className="text-slate-500">Gerencie as senhas de acesso do agente para controlar o histórico e permissões.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {editing ? (
          <div className="p-6 bg-slate-50/50 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-brand-600" /> {editing === 'new' ? 'Cadastrar Novo Usuário' : 'Editar Usuário'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Empresa (Tenant)</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                  value={formData.tenant_id || ''} 
                  onChange={e => setFormData({...formData, tenant_id: e.target.value})}
                >
                  <option value="">Selecione uma Empresa...</option>
                  <option value="default">Global (Padrão)</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Usuário Copilot</label>
                <input 
                  type="text" 
                  placeholder="Ex: joao.silva"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Senha</label>
                <input 
                  type="password" 
                  placeholder={editing === 'new' ? "***" : "Deixe em branco para manter"}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cargo (Papel)</label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all uppercase"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="USER">USER (Padrão)</option>
                  <option value="ADMIN">ADMIN</option>
                  {roles.filter(r => r.name !== 'USER' && r.name !== 'ADMIN' && (r.tenant_id === 'default' || r.tenant_id === formData.tenant_id)).map(r => (
                    <option key={r.id} value={r.name}>{r.name} {r.tenant_id !== 'default' ? '(Empresa)' : '(Global)'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><Save size={18} /> Salvar Usuário</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"><X size={18} /> Cancelar</button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Empresa (Tenant)</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Usuário Copilot</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Papel</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Data de Criação</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 font-mono">
                    {u.tenant_id === 'default' ? 'Global' : (tenants.find(t => t.id === u.tenant_id)?.name || u.tenant_id)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                        <User size={14} />
                      </div>
                      {u.username}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                      {u.role?.toUpperCase() || 'USER'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(u.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => handleEdit(u)} title="Editar Usuário" className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-100">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(u.id)} title="Remover Acesso" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <Users size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-500 font-medium">Nenhum usuário cadastrado.</p>
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

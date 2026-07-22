import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Shield, User as UserIcon, AlertCircle, X, Check } from 'lucide-react';

export default function CompanyUsers({ company }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const tenantId = company?.tenant_id;

  useEffect(() => {
    if (tenantId) fetchUsers();
  }, [tenantId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/users/${tenantId}`);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar a lista de usuários.');
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setRole('user');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword(''); // don't show existing password
    setRole(user.role);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!username.trim()) {
      setFormError('O nome de usuário é obrigatório.');
      return;
    }
    if (!editingUser && !password) {
      setFormError('A senha é obrigatória para novos usuários.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/register', {
        tenant_id: tenantId,
        username: username.trim(),
        password: password || undefined,
        role: role
      });
      await fetchUsers();
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Erro ao salvar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      await axios.delete(`/api/users/${userId}`);
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao excluir usuário.');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Carregando usuários...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UsersIcon className="text-brand-600" />
            Usuários do Copilot
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie quem tem acesso à base de conhecimento da empresa <strong>{company?.razao_social}</strong>
          </p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="m-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3 border border-red-200">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Usuário</th>
              <th className="px-6 py-4 font-semibold">Função (Role)</th>
              <th className="px-6 py-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                  Nenhum usuário cadastrado para este tenant.
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{user.username}</div>
                        <div className="text-xs text-slate-400">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {user.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar Usuário"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id, user.username)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Inclusão/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} />
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome de Usuário</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="ex: joao.silva"
                  />
                  {editingUser && <p className="text-xs text-slate-400 mt-1">O nome de usuário não pode ser alterado.</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editingUser ? 'Nova Senha (opcional)' : 'Senha'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder={editingUser ? "Deixe em branco para manter a atual" : "Senha segura"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Função (Role)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                  >
                    <option value="user">Usuário Comum (user)</option>
                    <option value="admin">Administrador (admin)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon helper
function UsersIcon(props) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}

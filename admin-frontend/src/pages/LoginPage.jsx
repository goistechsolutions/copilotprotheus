import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // basename=/admin já cuida do prefixo — usar paths relativos
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#1565C0]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-[#1565C0] to-[#2196F3] rounded-xl flex items-center justify-center shadow-lg shadow-[#1565C0]/30">
              <span className="text-white font-black text-xl">E</span>
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-xl tracking-tight">
                ELITE<span className="text-[#2196F3]">CORP</span>
              </div>
              <div className="text-[#8892A4] text-xs">Copilot Protheus</div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-white text-xl font-semibold mb-1">Acesso ao Painel</h1>
            <p className="text-[#8892A4] text-sm">Entre com suas credenciais de administrador</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#1565C0] to-[#2196F3] hover:from-[#1976D2] hover:to-[#42A5F5] text-white font-semibold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#1565C0]/25 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#8892A4]/50 text-xs mt-6">
          EliteCorp © {new Date().getFullYear()} · Copilot Protheus Admin
        </p>
      </div>
    </div>
  );
}

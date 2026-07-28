import { useState } from 'react';
import axios from '../api/axios';
import { Key, Copy, CheckCircle } from 'lucide-react';

export default function Licenses() {
  const [adminKey, setAdminKey] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plan, setPlan] = useState('premium');
  const [days, setDays] = useState(365);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setToken('');
    
    // Calcula a data de expiração com base nos dias escolhidos
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + parseInt(days));
    const expirationIso = expiration.toISOString();

    try {
      const res = await axios.post('/api/license/generate', 
        {
          cnpj: cnpj.replace(/[^0-9]/g, ''),
          expiration_date: expirationIso,
          plan_level: plan
        },
        {
          headers: { 'X-Admin-Key': adminKey }
        }
      );
      setToken(res.data.token);
    } catch (error) {
      alert("Erro ao gerar licença: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Gerador de Licenças Offline</h2>
        <p className="text-slate-500">Crie tokens JWT seguros para ativar empresas clientes (SaaS) sem necessidade de banco de dados na nuvem para validação.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* Formulário */}
        <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50">
          <form onSubmit={handleGenerate} className="space-y-5">
            
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Chave Admin (X-Admin-Key)</label>
              <input 
                type="password" 
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                placeholder="Insira a ADMIN_PASSWORD"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-2 font-medium">Requerido para assinar criptograficamente o JWT.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">CNPJ da Empresa</label>
              <input 
                type="text" 
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                placeholder="Ex: 00.000.000/0001-00"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nível do Plano</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                >
                  <option value="basic">Básico</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Validade (Dias)</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  value={days}
                  onChange={e => setDays(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold transition-all mt-4 shadow-sm"
            >
              <Key size={18} />
              {loading ? "Gerando..." : "Gerar Token de Licença"}
            </button>
          </form>
        </div>

        {/* Resultado */}
        <div className="p-6 md:w-1/2 bg-white flex flex-col items-center justify-center min-h-[300px]">
          {!token ? (
            <div className="text-center text-slate-400">
              <Key size={48} className="mx-auto mb-4 opacity-30 text-slate-300" />
              <p className="font-medium text-slate-500">O token gerado aparecerá aqui.</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <label className="block text-sm font-bold text-emerald-600 mb-3 flex items-center gap-2">
                <CheckCircle size={18} /> Licença Gerada com Sucesso!
              </label>
              <textarea 
                readOnly
                value={token}
                className="w-full flex-1 p-4 bg-slate-900 text-emerald-400 font-mono text-sm rounded-xl border border-slate-800 focus:outline-none mb-4 resize-none break-all shadow-inner"
              />
              <button 
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-lg transition-colors border border-emerald-200"
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copied ? "Copiado para a área de transferência!" : "Copiar Token"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

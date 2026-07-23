import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Save, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function Config() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState({});
  const [savedKey, setSavedKey] = useState(null);

  // Hardcoded basic auth for admin panel (Ideally use a login context)
  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' } // This matches the backend default
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      // Endpoint is /api/admin/config because proxy will be set, but let's use relative path since it's served on same origin
      const res = await axios.get('/api/admin/config');
      setConfigs(res.data.configs || {});
    } catch (error) {
      console.error("Erro ao carregar configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key, value) => {
    setSaving(true);
    try {
      await axios.post('/api/admin/config', { key, value });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
      setConfigs(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      alert("Erro ao salvar: " + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = (key) => {
    setShowPass(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Carregando configurações...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Configurações de Ambiente</h2>
        <p className="text-slate-500">Gerencie as variáveis de ambiente (.env) da ferramenta. As alterações são aplicadas imediatamente ao backend quando você remove o foco do campo.</p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 lg:p-8">
          <div className="space-y-6">
            {Object.entries(configs).map(([key, val]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{key}</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type={key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') ? (showPass[key] ? 'text' : 'password') : 'text'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono text-sm"
                      defaultValue={val}
                      disabled={saving}
                      onBlur={(e) => {
                        if (e.target.value !== val) handleUpdate(key, e.target.value);
                      }}
                    />
                    {(key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')) && (
                      <button 
                        onClick={() => toggleShow(key)}
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPass[key] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                  {savedKey === key && (
                    <div className="flex items-center text-emerald-600 gap-1.5 animate-pulse shrink-0 px-2">
                      <CheckCircle size={18} />
                      <span className="text-sm font-semibold">Salvo!</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

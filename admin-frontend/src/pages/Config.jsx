import { useState, useEffect } from 'react';
import axios from 'axios';
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
      const res = await axios.get('/api/admin/config', axiosConfig);
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
      await axios.post('/api/admin/config', { key, value }, axiosConfig);
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

  if (loading) return <div className="p-8 text-slate-500">Carregando configurações...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Configurações Globais</h2>
        <p className="text-slate-500">Gerencie as variáveis de ambiente (.env) da ferramenta. As alterações são aplicadas imediatamente ao backend.</p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="space-y-6">
            {Object.entries(configs).map(([key, val]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">{key}</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type={key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY') ? (showPass[key] ? 'text' : 'password') : 'text'}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                      defaultValue={val}
                      onBlur={(e) => {
                        if (e.target.value !== val) handleUpdate(key, e.target.value);
                      }}
                    />
                    {(key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) && (
                      <button 
                        onClick={() => toggleShow(key)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPass[key] ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                  {savedKey === key && (
                    <div className="flex items-center text-emerald-600 gap-1 animate-pulse">
                      <CheckCircle size={18} />
                      <span className="text-sm font-medium">Salvo</span>
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

import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Save, Eye, EyeOff, CheckCircle, BrainCircuit } from 'lucide-react';

export default function Config() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState({});
  const [savedKey, setSavedKey] = useState(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
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

  const renderField = (key, val, labelOverride = null) => (
    <div key={key} className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{labelOverride || key}</label>
      <div className="flex gap-3">
        <div className="relative flex-1">
          {key === 'LLM_BACKEND' ? (
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-semibold text-sm"
              value={configs['LLM_BACKEND'] || 'gemini'}
              disabled={saving}
              onChange={(e) => handleUpdate('LLM_BACKEND', e.target.value)}
            >
              <option value="gemini">Google Gemini (Nuvem)</option>
              <option value="ollama">Ollama (Local / On-Premise)</option>
            </select>
          ) : (
            <input
              type={key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') ? (showPass[key] ? 'text' : 'password') : 'text'}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-mono text-sm"
              value={configs[key] || ''}
              disabled={saving}
              onChange={(e) => setConfigs(prev => ({ ...prev, [key]: e.target.value }))}
              onBlur={(e) => {
                if (e.target.value !== val) handleUpdate(key, e.target.value);
              }}
            />
          )}
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
  );

  if (loading) return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Carregando configurações...</div></div>;

  const isOllama = configs['LLM_BACKEND'] === 'ollama';
  const aiKeys = ['LLM_BACKEND', 'GEMINI_MODEL', 'GEMINI_API_KEY', 'OLLAMA_MODEL', 'OLLAMA_BASE_URL'];
  
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Gerenciador Protheus Control</h2>
        <p className="text-slate-500">Configure as variáveis globais do sistema e o motor de inteligência artificial.</p>
      </div>
      
      {/* SEÇÃO MOTOR DE IA */}
      <div className="bg-gradient-to-br from-indigo-50 to-brand-50 rounded-2xl shadow-sm border border-brand-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BrainCircuit size={120} />
        </div>
        <div className="p-6 lg:p-8 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/20">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Motor de Inteligência Artificial</h3>
              <p className="text-sm text-slate-600">Escolha onde as inferências do Copilot serão executadas</p>
            </div>
          </div>
          
          <div className="space-y-6 max-w-3xl">
            {renderField('LLM_BACKEND', configs['LLM_BACKEND'], 'Provedor Ativo')}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 p-5 bg-white/60 rounded-xl border border-white/80">
              {!isOllama ? (
                <>
                  <div className="col-span-full">
                    <p className="text-sm text-slate-600 mb-3 border-l-2 border-brand-400 pl-3"><strong>Google Gemini:</strong> Alta velocidade e qualidade via API Cloud.</p>
                  </div>
                  <div className="col-span-full">{renderField('GEMINI_API_KEY', configs['GEMINI_API_KEY'])}</div>
                  <div className="col-span-full">{renderField('GEMINI_MODEL', configs['GEMINI_MODEL'])}</div>
                </>
              ) : (
                <>
                  <div className="col-span-full">
                    <p className="text-sm text-slate-600 mb-3 border-l-2 border-indigo-400 pl-3"><strong>Ollama Local:</strong> Inferência rodando na sua própria infraestrutura (Privacidade total).</p>
                  </div>
                  <div className="col-span-full">{renderField('OLLAMA_BASE_URL', configs['OLLAMA_BASE_URL'], 'URL do Ollama')}</div>
                  <div className="col-span-full">{renderField('OLLAMA_MODEL', configs['OLLAMA_MODEL'], 'Nome do Modelo (ex: llama3)')}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO CONFIGURAÇÕES AVANÇADAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800">Configurações Avançadas</h3>
        </div>
        <div className="p-6 lg:p-8">
          <div className="space-y-6">
            {Object.entries(configs)
              .filter(([key]) => !aiKeys.includes(key))
              .map(([key, val]) => renderField(key, val))}
          </div>
        </div>
      </div>
    </div>
  );
}

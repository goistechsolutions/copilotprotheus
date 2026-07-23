import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Building2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Tables() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('default');
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modulosInput, setModulosInput] = useState('SIGAFAT, SIGAFIN');
  const [syncResult, setSyncResult] = useState(null);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchSchemas(selectedTenant);
    }
  }, [selectedTenant]);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/companies', axiosConfig);
      setTenants(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    }
  };

  const fetchSchemas = async (tenantId) => {
    setLoading(true);
    setSyncResult(null);
    try {
      const res = await axios.get(`/api/admin/schemas?tenant_id=${tenantId}`, axiosConfig);
      setSchemas(res.data.schemas || []);
    } catch (error) {
      console.error("Erro ao carregar schemas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm(`Tem certeza que deseja sincronizar o schema do Protheus para o tenant ${selectedTenant}? Isso pode demorar alguns minutos.`)) {
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    
    const modulosArray = modulosInput
      .split(',')
      .map(m => m.trim().toUpperCase())
      .filter(m => m.length > 0);

    try {
      const res = await axios.post('/api/admin/sync-schema', { 
        tenant_id: selectedTenant,
        modulos: modulosArray
      }, axiosConfig);
      
      setSyncResult({ type: 'success', message: res.data.message });
      fetchSchemas(selectedTenant);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      const detail = error.response?.data?.detail || error.message;
      setSyncResult({ type: 'error', message: `Erro ao sincronizar: ${detail}` });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Dicionário de Dados</h2>
          <p className="text-slate-500">Sincronize as tabelas e campos permitidos diretamente do Protheus por Empresa (Tenant).</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="bg-brand-50 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
          <Building2 className="text-brand-600" size={24} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Selecione o Tenant (Empresa):</label>
          <select 
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="w-full sm:w-80 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 transition-all"
          >
            <option value="default">Default (Padrão Global)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.tenant_id || t.protheus_grupo}>
                {t.razao_social || t.name} ({t.tenant_id || t.protheus_grupo})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Sincronizar Estrutura do ERP</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Módulos Permitidos (separados por vírgula):</label>
            <input 
              type="text" 
              value={modulosInput} 
              onChange={(e) => setModulosInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none uppercase font-mono transition-all text-slate-800"
              placeholder="Ex: SIGAFAT, SIGAFIN, SIGAEST"
            />
            <p className="text-xs text-slate-500 mt-1">Deixe em branco para sincronizar TODOS os módulos.</p>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing || selectedTenant === 'default'}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Iniciar Sincronização"}
          </button>
        </div>

        {syncResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${syncResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {syncResult.type === 'success' ? <CheckCircle2 size={20} className="mt-0.5 text-green-600" /> : <AlertCircle size={20} className="mt-0.5 text-red-600" />}
            <div>
              <h4 className="font-bold">{syncResult.type === 'success' ? 'Sucesso!' : 'Falha na Sincronização'}</h4>
              <p className="text-sm mt-1">{syncResult.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Database size={18} className="text-brand-600" />
            Estrutura Atual do Tenant
          </h3>
          <span className="text-xs font-semibold bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 shadow-sm">
            Total: {schemas.length} Tabelas
          </span>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="animate-pulse font-medium text-brand-600">Carregando dicionário do Tenant...</div>
          </div>
        )}
        
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Módulo</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tabela (Chave)</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Descrição</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">Campos</th>
                <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">Filial?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schemas.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-slate-600">{s.modulo}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{s.tabela}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{s.chave}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 truncate max-w-xs" title={s.nome}>{s.nome}</td>
                  <td className="px-6 py-3 text-center">
                    <span className="inline-flex items-center justify-center bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {s.campos_count}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    {s.compartilhamento?.filial === 'S' 
                      ? <span className="text-green-600 font-bold text-sm">Sim</span>
                      : <span className="text-slate-400 text-sm">Não</span>
                    }
                  </td>
                </tr>
              ))}
              {schemas.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center bg-slate-50/50">
                    <Database size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-600 font-semibold mb-1">Nenhum dicionário sincronizado.</p>
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

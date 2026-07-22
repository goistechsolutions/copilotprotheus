import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CompanyDictionary({ company }) {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modulosInput, setModulosInput] = useState(['SIGAFAT', 'SIGAFIN']);
  const [syncResult, setSyncResult] = useState(null);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    if (company?.tenant_id) {
      fetchSchemas(company.tenant_id);
    }
  }, [company]);

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
    if (!company?.tenant_id) {
      alert("Empresa não possui tenant vinculado!");
      return;
    }
    if (!confirm(`Tem certeza que deseja sincronizar o schema do Protheus para ${company.razao_social}? Isso pode demorar alguns minutos.`)) {
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    
    const modulosArray = modulosInput.length > 0 ? modulosInput : [];
    try {
      const res = await axios.post('/api/admin/sync-schema', { 
        tenant_id: company.tenant_id,
        modulos: modulosArray
      }, axiosConfig);
      
      setSyncResult({ type: 'success', message: res.data.message });
      fetchSchemas(company.tenant_id);
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      const detail = error.response?.data?.detail || error.message;
      setSyncResult({ type: 'error', message: `Erro ao sincronizar: ${detail}` });
    } finally {
      setSyncing(false);
    }
  };

  if (!company?.tenant_id) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Database size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Tenant Não Vinculado</h3>
        <p className="text-slate-500 mt-2">Você precisa configurar um Tenant_ID na aba Geral antes de acessar o Dicionário.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Sincronizar Estrutura do ERP</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Módulos Permitidos (Múltipla Seleção):</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {['SIGAFAT', 'SIGAFIN', 'SIGACOM', 'SIGAEST', 'SIGAPCP', 'SIGACONT', 'SIGAFIS', 'SIGATMS', 'SIGAGPE', 'SIGAATF'].map(mod => (
                <label key={mod} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer transition-colors ${modulosInput.includes(mod) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={modulosInput.includes(mod)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setModulosInput([...modulosInput, mod]);
                      } else {
                        setModulosInput(modulosInput.filter(m => m !== mod));
                      }
                    }}
                  />
                  {mod}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Deixe todos desmarcados para sincronizar TODOS os módulos.</p>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing}
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
            Estrutura Atual: {company.tenant_id}
          </h3>
          <span className="text-xs font-semibold bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 shadow-sm">
            Total: {schemas.length} Tabelas
          </span>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="animate-pulse font-medium text-brand-600">Carregando dicionário...</div>
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

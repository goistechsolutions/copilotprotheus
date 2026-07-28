import { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Search, ChevronDown } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function Tables() {
  const [tenants, setTenants]         = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('default');
  const [schemas, setSchemas]         = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [modulosInput, setModulosInput] = useState('SIGAFAT, SIGAFIN');
  const [syncResult, setSyncResult]   = useState(null);

  useEffect(() => { fetchTenants(); }, []);
  useEffect(() => { if (selectedTenant) fetchSchemas(selectedTenant); }, [selectedTenant]);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? schemas.filter(s =>
      s.tabela?.toLowerCase().includes(q) ||
      s.nome?.toLowerCase().includes(q) ||
      s.modulo?.toLowerCase().includes(q)
    ) : schemas);
  }, [search, schemas]);

  const fetchTenants = async () => {
    try { const res = await axios.get('/api/companies'); setTenants(res.data || []); } catch {}
  };

  const fetchSchemas = async (tenantId) => {
    setLoading(true); setSyncResult(null);
    try {
      const res = await axios.get(`/api/admin/schemas?tenant_id=${tenantId}`);
      setSchemas(res.data.schemas || []);
    } catch { setSchemas([]); }
    setLoading(false);
  };

  const handleSync = async () => {
    if (!confirm(`Sincronizar schema do tenant ${selectedTenant}?`)) return;
    setSyncing(true); setSyncResult(null);
    const modulos = modulosInput.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
    try {
      const res = await axios.post('/api/admin/sync-schema', { tenant_id: selectedTenant, modulos });
      setSyncResult({ type: 'success', message: res.data.message });
      fetchSchemas(selectedTenant);
    } catch (e) {
      setSyncResult({ type: 'error', message: e.response?.data?.detail || e.message });
    }
    setSyncing(false);
  };

  return (
    <div>
      <PageHeader title="Tabelas & Campos" description="Navegue pelo dicionário de dados extraído do Protheus." />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tabela, módulo..."
            className="w-full bg-[#161B27] border border-[#1E2535] rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
            className="appearance-none bg-[#161B27] border border-[#1E2535] text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-[#2196F3] transition-all cursor-pointer"
          >
            <option value="default">Default (Global)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.tenant_id || t.protheus_grupo}>
                {t.razao_social || t.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
        </div>
      </div>

      {/* Sync inline */}
      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-4 mb-5 flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-[#8892A4] uppercase tracking-wider mb-1.5">Módulos para sincronizar</label>
          <input
            value={modulosInput} onChange={e => setModulosInput(e.target.value)}
            className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] transition-all uppercase"
            placeholder="Ex: SIGAFAT, SIGAFIN, SIGAEST"
          />
        </div>
        <button
          onClick={handleSync} disabled={syncing || selectedTenant === 'default'}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E2535] hover:bg-[#1565C0]/30 border border-[#1E2535] hover:border-[#1565C0]/50 text-[#8892A4] hover:text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {syncResult && (
        <div className={`mb-4 flex items-start gap-3 rounded-xl p-3.5 text-sm border ${
          syncResult.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {syncResult.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{syncResult.message}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E2535] flex items-center justify-between">
          <div className="flex items-center gap-2 text-white text-sm font-semibold">
            <Database className="w-4 h-4 text-[#2196F3]" />
            Estrutura do Tenant
          </div>
          <span className="text-xs text-[#8892A4] bg-[#0F1117] border border-[#1E2535] px-2 py-1 rounded">
            {filtered.length} tabelas
          </span>
        </div>
        <div className="overflow-x-auto max-h-[560px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#161B27] border-b border-[#1E2535]">
                <tr>
                  {['Módulo','Tabela','Descrição','Campos','Filial'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-[#8892A4] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2535]">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-[#1E2535]/50 transition-colors">
                    <td className="px-5 py-3 text-[#8892A4] font-mono text-xs">{s.modulo}</td>
                    <td className="px-5 py-3">
                      <span className="text-white font-semibold font-mono">{s.tabela}</span>
                      {s.chave && <span className="ml-2 text-[10px] text-[#8892A4] bg-[#0F1117] border border-[#1E2535] px-1.5 py-0.5 rounded">{s.chave}</span>}
                    </td>
                    <td className="px-5 py-3 text-[#8892A4] max-w-xs truncate" title={s.nome}>{s.nome}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-xs bg-[#1565C0]/20 text-[#2196F3] px-2 py-0.5 rounded-full font-semibold">{s.campos_count}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs">
                      {s.compartilhamento?.filial === 'S'
                        ? <span className="text-emerald-400 font-semibold">Sim</span>
                        : <span className="text-[#8892A4]">Não</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-[#8892A4]">
                    <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma tabela sincronizada.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

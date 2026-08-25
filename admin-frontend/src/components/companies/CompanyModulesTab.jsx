import { useEffect, useMemo, useState } from 'react';
import {
  getAvailableModules,
  getCompanyModules,
  saveCompanyModules,
  syncCompanyModules,
} from '../../services/companyModulesApi';
import { Layers, Save, RefreshCw, CheckSquare, Square, Search, AlertCircle, CheckCircle2, Loader2, Database } from 'lucide-react';

export default function CompanyModulesTab({ company }) {
  const [availableModules, setAvailableModules] = useState([]);
  const [selectedMap, setSelectedMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  const companyId = company?.id;

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const [availableRes, assignedRes] = await Promise.all([
        getAvailableModules(companyId),
        getCompanyModules(companyId),
      ]);

      const available = availableRes?.items || [];
      const assigned = assignedRes?.items || [];

      const assignedMap = {};
      for (const item of assigned) {
        assignedMap[item.module_code] = !!item.enabled;
      }

      setAvailableModules(available);
      setSelectedMap(assignedMap);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Falha ao carregar módulos da empresa. Verifique a conexão com o servidor REST.'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(moduleCode) {
    setSelectedMap((prev) => ({
      ...prev,
      [moduleCode]: !prev[moduleCode],
    }));
  }

  function selectAll() {
    const next = {};
    for (const item of filteredModules) {
      next[item.module_code] = true;
    }
    setSelectedMap((prev) => ({ ...prev, ...next }));
  }

  function clearAll() {
    const next = { ...selectedMap };
    for (const item of filteredModules) {
      next[item.module_code] = false;
    }
    setSelectedMap(next);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const modules = availableModules
        .filter((item) => !!selectedMap[item.module_code])
        .map((item) => ({
          module_code: item.module_code,
          enabled: true,
        }));

      const res = await saveCompanyModules(companyId, modules);

      setMessage(`Módulos salvos com sucesso. Total: ${res.modules_saved}`);
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Falha ao salvar módulos da empresa.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await syncCompanyModules(companyId, false);
      const syncedModules = res?.module_filter?.join(', ') || '-';
      setMessage(`Sincronização concluída com sucesso! Módulos sincronizados: ${syncedModules}`);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          'Falha ao sincronizar dicionário por módulos.'
      );
    } finally {
      setSyncing(false);
    }
  }

  const filteredModules = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return availableModules;

    return availableModules.filter((item) => {
      const code = item.module_code?.toLowerCase() || '';
      const name = item.module_name?.toLowerCase() || '';
      return code.includes(term) || name.includes(term);
    });
  }, [availableModules, filter]);

  const selectedCount = Object.values(selectedMap).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Módulos Protheus Autorizados</h3>
            <p className="text-sm text-slate-500">
              Selecione os módulos permitidos para o contrato desta empresa e sincronize o dicionário filtrado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading || saving || syncing}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors"
            title="Recarregar lista de módulos do servidor"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recarregar</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || syncing}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? 'Salvando...' : 'Salvar módulos'}</span>
          </button>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading || saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-all"
            title="Sincronizar dicionário focado apenas nos módulos autorizados"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar dicionário'}</span>
          </button>
        </div>
      </div>

      <div className="mb-5 grid items-center gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por código ou nome do módulo (ex: FAT, FIN, Estoque)..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>

        <button
          type="button"
          onClick={selectAll}
          disabled={loading || filteredModules.length === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <CheckSquare className="h-4 w-4 text-blue-600" />
          <span>Marcar filtrados</span>
        </button>

        <button
          type="button"
          onClick={clearAll}
          disabled={loading || filteredModules.length === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <Square className="h-4 w-4 text-slate-400" />
          <span>Desmarcar filtrados</span>
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
          <span>
            Módulos autorizados para esta empresa: <strong className="text-slate-900 font-bold">{selectedCount}</strong> de {availableModules.length} disponíveis
          </span>
        </div>
        {selectedCount > 0 && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            Escopo ativo
          </span>
        )}
      </div>

      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800 shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-slate-500">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
          <span className="font-medium text-slate-600">Carregando catálogo de módulos do Protheus...</span>
          <span className="text-xs text-slate-400 mt-1">Consultando SYS_USR_MODULE via API REST</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/90">
              <tr>
                <th scope="col" className="w-16 px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ativo
                </th>
                <th scope="col" className="w-32 px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Código
                </th>
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nome do módulo
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredModules.map((item) => {
                const isChecked = !!selectedMap[item.module_code];
                return (
                  <tr
                    key={item.module_code}
                    onClick={() => toggleModule(item.module_code)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                      isChecked ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModule(item.module_code)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm font-mono font-semibold text-slate-900">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        isChecked ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.module_code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-700">
                      {item.module_name}
                    </td>
                  </tr>
                );
              })}

              {filteredModules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Layers className="h-8 w-8 text-slate-300 mb-2" />
                      <span className="font-medium text-slate-600">Nenhum módulo encontrado</span>
                      {filter ? (
                        <span className="text-xs text-slate-400 mt-1">Nenhum resultado para o filtro "{filter}"</span>
                      ) : (
                        <span className="text-xs text-slate-400 mt-1">A consulta à SYS_USR_MODULE não retornou módulos registrados.</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

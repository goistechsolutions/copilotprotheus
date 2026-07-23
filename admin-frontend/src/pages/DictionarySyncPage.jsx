import React, { useMemo, useState } from 'react';
import api from '../api/axios';
import { Database, Play, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';

export default function DictionarySyncPage() {
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000000');
  const [companyId, setCompanyId] = useState('');
  const [envId, setEnvId] = useState('');
  const [modules, setModules] = useState('');
  const [snapshotCode, setSnapshotCode] = useState('');
  
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const payload = useMemo(() => ({
    tenant_id: tenantId,
    company_id: companyId || null,
    env_id: envId || null,
    modules: modules ? modules.split(',').map(v => v.trim()).filter(Boolean) : null,
    snapshot_code: snapshotCode || null,
    requested_by: 'admin-dashboard',
  }), [tenantId, companyId, envId, modules, snapshotCode]);

  const startSync = async () => {
    setLoading(true); 
    setError('');
    setStatus(null);
    try {
      const { data } = await api.post('/api/admin/sync/dictionary/start', payload);
      setStatus(data);
      if (data.snapshot_code) {
        setSnapshotCode(data.snapshot_code);
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
            <Database className="w-6 h-6 mr-3 text-brand-600" />
            Sincronização de Dicionário
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Inicie a extração de metadados do Protheus para criação de um novo Snapshot de governança.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tenant ID (Obrigatório)</label>
              <input 
                type="text" 
                value={tenantId} 
                onChange={e => setTenantId(e.target.value)} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
                placeholder="UUID do Cliente"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company ID (Opcional)</label>
              <input 
                type="text" 
                value={companyId} 
                onChange={e => setCompanyId(e.target.value)} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
                placeholder="UUID da Empresa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Environment ID (Opcional)</label>
              <input 
                type="text" 
                value={envId} 
                onChange={e => setEnvId(e.target.value)} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
                placeholder="UUID do Ambiente"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Módulos (Vírgula)</label>
              <input 
                type="text" 
                value={modules} 
                onChange={e => setModules(e.target.value)} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
                placeholder="Ex: SIGAFAT, SIGAFIN"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Snapshot Code Personalizado (Opcional)</label>
              <input 
                type="text" 
                value={snapshotCode} 
                onChange={e => setSnapshotCode(e.target.value)} 
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
                placeholder="Ex: v1.0.0-fat"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-slate-100">
            <button 
              disabled={loading || !tenantId} 
              onClick={startSync}
              className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando Worker...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Iniciar Sincronização</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 shadow-sm animate-in fade-in">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Falha ao iniciar</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 shadow-sm animate-in fade-in">
          <div className="flex">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-emerald-800">Job Aceito (Background)</h3>
              <div className="mt-2 text-sm text-emerald-700 space-y-1">
                <p>Status: <strong>{status.status}</strong></p>
                <p>Código: <strong className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{status.snapshot_code}</strong></p>
                <p className="text-xs mt-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" /> Processo rodando de forma assíncrona. Verifique Snapshots.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

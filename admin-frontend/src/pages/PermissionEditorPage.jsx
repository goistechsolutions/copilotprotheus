import React, { useState } from 'react';
import api from '../api/axios';
import { ShieldCheck, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function PermissionEditorPage() {
  const [snapshotId, setSnapshotId] = useState('33333333-3333-3333-3333-333333333333');
  const [contractId, setContractId] = useState('00000000-0000-0000-0000-000000000000');
  
  const [json, setJson] = useState(`{
  "allowed_tables": [
    {
      "table_id": "11111111-1111-1111-1111-111111111111",
      "access_level": "query",
      "rationale": "Permissão consulta NF"
    }
  ],
  "allowed_fields": []
}`);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const save = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const parsed = JSON.parse(json);
      const payload = { contract_id: contractId, ...parsed };
      const { data } = await api.post(`/api/admin/dictionary/${snapshotId}/permit`, payload);
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
            <ShieldCheck className="w-6 h-6 mr-3 text-brand-600" />
            Editor de Permissões
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Defina as políticas de acesso a um Snapshot para um Contrato específico.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Snapshot ID</label>
            <input 
              type="text" 
              value={snapshotId} 
              onChange={e => setSnapshotId(e.target.value)} 
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contract ID</label>
            <input 
              type="text" 
              value={contractId} 
              onChange={e => setContractId(e.target.value)} 
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm px-4 py-2 border"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-6 border-r border-slate-200 bg-slate-50">
            <textarea 
              rows="12" 
              value={json} 
              onChange={e => setJson(e.target.value)} 
              className="w-full font-mono text-sm rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-4 border bg-slate-900 text-green-400"
              spellCheck="false"
            />
            <div className="mt-4 flex justify-end">
              <button 
                onClick={save}
                disabled={loading}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 shadow-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </button>
            </div>
          </div>

          <div className="w-full md:w-1/3 p-6 flex flex-col">
            <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Status</h3>
            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-400 mb-2" />
                <div className="text-sm text-red-700 break-all">{error}</div>
              </div>
            )}
            {result && (
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 shadow-sm">
                <CheckCircle className="w-5 h-5 text-emerald-500 mb-2" />
                <div className="text-sm text-emerald-700 space-y-1">
                  <p>Tabelas: <strong>{result.tables_permitted}</strong></p>
                  <p>Campos: <strong>{result.fields_permitted}</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

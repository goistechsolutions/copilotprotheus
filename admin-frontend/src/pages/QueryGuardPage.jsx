import React, { useState } from 'react';
import api from '../api/axios';
import { Activity, Play, Terminal, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

export default function QueryGuardPage() {
  const [json, setJson] = useState(`{
  "tenant_id": "00000000-0000-0000-0000-000000000000",
  "contract_id": "00000000-0000-0000-0000-000000000000",
  "request_id": "REQ-TEST-1",
  "tables_used": [],
  "fields_used": [],
  "sql_preview": "SELECT 1 FROM DUAL WHERE D_E_L_E_T_ = ' '"
}`);
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/api/agent/validate-query', JSON.parse(json));
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
            <Activity className="w-6 h-6 mr-3 text-brand-600" />
            Query Guard (Simulador)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Valide a segurança e o escopo do SQL gerado pelo Agente.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
        <div className="flex-1 p-6 border-r border-slate-200">
          <div className="flex justify-end mb-4">
            <button 
              onClick={validate}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Executar Interceptor
            </button>
          </div>
          <textarea 
            rows="16" 
            value={json} 
            onChange={e => setJson(e.target.value)} 
            className="w-full font-mono text-sm rounded-lg border-slate-300 shadow-sm p-4 border bg-slate-900 text-blue-300"
            spellCheck="false"
          />
        </div>

        <div className="w-full lg:w-1/3 bg-slate-50 p-6 flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Relatório</h3>
          {error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 shadow-sm text-sm text-red-700">{error}</div>
          )}
          {result && (
            <div className="space-y-4">
              {result.allowed ? (
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 flex items-start">
                  <ShieldCheck className="w-6 h-6 text-emerald-500 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Aprovada</h4>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 flex items-start">
                  <ShieldAlert className="w-6 h-6 text-rose-500 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Bloqueada</h4>
                    <p className="text-sm text-rose-700 mt-1">{result.blocked_reason}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { History, Search, Box, Calendar, ChevronRight } from 'lucide-react';

export default function SnapshotsPage() {
  const [tenantId, setTenantId] = useState('00000000-0000-0000-0000-000000000000');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if(!tenantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/dictionary/${tenantId}/snapshots`);
      setData(res.data);
    } catch (e) {
      console.error(e);
      setData({ items: [] });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center">
            <History className="w-6 h-6 mr-3 text-brand-600" />
            Histórico de Snapshots
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe as versões dos dicionários capturados para o tenant.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200 p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-brand-50 rounded-md p-3">
              <Box className="h-6 w-6 text-brand-600" />
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-slate-500 truncate">Total Snapshots</dt>
                <dd className="text-2xl font-semibold text-slate-900">{data?.items?.length || 0}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
            placeholder="Tenant ID..."
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>
        <button
          onClick={load}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 shadow-sm"
        >
          Pesquisar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : !data?.items?.length ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum snapshot encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status / ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Módulos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Criado em</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {data.items.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-2.5 w-2.5 rounded-full mr-2 ${snap.status === 'completed' ? 'bg-green-500' : snap.status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                        <div className="text-sm font-medium text-slate-900 font-mono text-xs">{snap.id.split('-')[0]}...</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {snap.snapshot_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {snap.modules ? snap.modules.join(', ') : 'Todos'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-slate-400" />
                      {new Date(snap.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-brand-600 hover:text-brand-900 inline-flex items-center">
                        Ver <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

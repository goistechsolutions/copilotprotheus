import { useState, useEffect } from 'react';
import axios from 'axios';
import { TerminalSquare, Calendar, Database, Clock } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get('/api/admin/logs?limit=50', axiosConfig);
      setLogs(res.data.logs || []);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Carregando métricas e logs...</div>;

  return (
    <div className="max-w-6xl">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Métricas e Logs</h2>
      <p className="text-slate-500 mb-8">Histórico de interações recentes do Copilot com o ERP.</p>

      {/* Basic Metrics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <TerminalSquare size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Consultas Realizadas</p>
            <p className="text-2xl font-bold text-slate-800">{logs.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-lg text-purple-600">
            <Database size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tabelas Ativas</p>
            <p className="text-2xl font-bold text-slate-800">10</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Status do Sistema</p>
            <p className="text-2xl font-bold text-emerald-600">Online</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700">Histórico de Conversas (Top 50)</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum log registrado ainda.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                    <Calendar size={14} />
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-medium text-slate-400">ID: {log.id} | Tenant: {log.tenant_id}</span>
                </div>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Usuário:</p>
                  <p className="text-sm text-slate-600 bg-slate-100 p-3 rounded-lg">{log.question}</p>
                </div>
                {log.sql_used && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-blue-600 mb-1">Query SQL Gerada:</p>
                    <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                      {log.sql_used}
                    </pre>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-emerald-600 mb-1">Resposta da IA:</p>
                  <div className="text-sm text-slate-600 prose prose-sm max-w-none bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    {log.answer?.substring(0, 300)} {log.answer?.length > 300 ? '...' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

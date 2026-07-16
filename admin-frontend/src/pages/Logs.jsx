import { useState, useEffect } from 'react';
import axios from 'axios';
import { TerminalSquare, Calendar, Database, Clock, Brain, Activity, Search, Building } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_consultas: 0,
    empresas_ativas: 0,
    usuarios_cadastrados: 0,
    total_memorias: 0,
    consultas_24h: 0,
    status_sistema: 'Verificando...'
  });
  const [loading, setLoading] = useState(true);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        axios.get('/api/admin/dashboard-stats', axiosConfig).catch(() => ({ data: {} })),
        axios.get('/api/admin/logs?limit=50', axiosConfig).catch(() => ({ data: { logs: [] } }))
      ]);
      
      if (statsRes.data.status_sistema) {
        setStats(statsRes.data);
      }
      setLogs(logsRes.data.logs || []);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium animate-pulse">Carregando métricas e logs...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Visão Geral do Sistema</h2>
        <p className="text-slate-500">Acompanhe as métricas globais e o fluxo de requisições da IA.</p>
      </div>

      {/* Modern Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
            <TerminalSquare size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Consultas IA (Total)</p>
            <p className="text-3xl font-bold text-slate-800">{stats.total_consultas}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">+{stats.consultas_24h} nas últimas 24h</p>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 shrink-0">
            <Building size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Empresas & Usuários</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-slate-800">{stats.empresas_ativas}</p>
              <span className="text-sm font-medium text-slate-400">SaaS</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">{stats.usuarios_cadastrados} usuários vinculados</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600 shrink-0">
            <Brain size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Memórias Salvas (RAG)</p>
            <p className="text-3xl font-bold text-slate-800">{stats.total_memorias}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Fatos extraídos do ERP</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-500 shrink-0 relative">
            <Activity size={24} />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Status da API</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.status_sistema}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">Todos os serviços normais</p>
          </div>
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Histórico de Interações (Audit)</h3>
            <p className="text-sm text-slate-500">Últimas 50 consultas realizadas ao assistente.</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar logs..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
            />
          </div>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Database size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Nenhum log registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data & Origem</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário / Prompt</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Execução</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 font-mono mt-1">
                        Tenant: {log.tenant_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top max-w-sm">
                      <div className="mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Input</span>
                        <p className="text-sm text-slate-800 font-medium line-clamp-2 mt-0.5" title={log.question}>
                          "{log.question}"
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Response</span>
                        <p className="text-sm text-slate-600 line-clamp-2 mt-0.5" title={log.answer}>
                          {log.answer}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {log.sql_used ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <Database size={12} /> SQL Gerado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Apenas Texto
                        </span>
                      )}
                      {log.response_time_ms && (
                        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1">
                          <Clock size={12} /> {log.response_time_ms}ms
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <button className="text-sm font-medium text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver Detalhes
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

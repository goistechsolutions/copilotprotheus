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
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-medium animate-pulse">Carregando métricas e logs...</p>
    </div>
  );

  return (
    <div className="space-y-6 text-slate-200">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Dashboard Analítico</h2>
        <p className="text-slate-400">Acompanhe as métricas globais e o fluxo de requisições da inteligência artificial.</p>
      </div>

      {/* Modern Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="glass-panel p-6 rounded-2xl flex items-start gap-4 transition-transform hover:-translate-y-1">
          <div className="bg-brand-500/20 p-3 rounded-xl text-brand-400 shrink-0 border border-brand-500/30">
            <TerminalSquare size={26} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Consultas IA (Total)</p>
            <p className="text-3xl font-black text-white drop-shadow-md">{stats.total_consultas}</p>
            <p className="text-xs text-emerald-400 font-medium mt-1">+{stats.consultas_24h} nas últimas 24h</p>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="glass-panel p-6 rounded-2xl flex items-start gap-4 transition-transform hover:-translate-y-1">
          <div className="bg-indigo-500/20 p-3 rounded-xl text-indigo-400 shrink-0 border border-indigo-500/30">
            <Building size={26} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Empresas SaaS</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-white drop-shadow-md">{stats.empresas_ativas}</p>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">{stats.usuarios_cadastrados} usuários vinculados</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel p-6 rounded-2xl flex items-start gap-4 transition-transform hover:-translate-y-1">
          <div className="bg-purple-500/20 p-3 rounded-xl text-purple-400 shrink-0 border border-purple-500/30">
            <Brain size={26} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Memórias Salvas</p>
            <p className="text-3xl font-black text-white drop-shadow-md">{stats.total_memorias}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Fatos RAG extraídos</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel p-6 rounded-2xl flex items-start gap-4 transition-transform hover:-translate-y-1">
          <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400 shrink-0 border border-emerald-500/30 relative">
            <Activity size={26} />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status da API</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 drop-shadow-md">{stats.status_sistema}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Serviços operacionais</p>
          </div>
        </div>

      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden mt-8">
        <div className="p-6 border-b border-white/10 glass-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-white text-lg">Histórico de Interações (Audit)</h3>
            <p className="text-sm text-slate-400">Últimas 50 consultas realizadas ao assistente.</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar logs..." 
              className="glass-input pl-9 pr-4 py-2 rounded-lg text-sm w-full sm:w-64"
            />
          </div>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Database size={48} className="text-slate-600 mb-4 opacity-50" />
            <p className="text-slate-400 font-medium">Nenhum log registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/5">Data & Origem</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/5">Usuário / Prompt</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/5">Execução</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5 align-top">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="text-sm font-medium text-slate-300">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <span className="inline-block px-2.5 py-1 rounded text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
                        Tenant: {log.tenant_id}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-top max-w-sm">
                      <div className="mb-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Input</span>
                        <p className="text-sm text-slate-200 font-medium line-clamp-2 mt-1" title={log.question}>
                          "{log.question}"
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Response</span>
                        <p className="text-sm text-slate-400 line-clamp-2 mt-1 italic" title={log.answer}>
                          {log.answer}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      {log.sql_used ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Database size={12} /> SQL Gerado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 text-slate-400 border border-white/10">
                          Apenas Texto
                        </span>
                      )}
                      {log.response_time_ms && (
                        <p className="text-xs font-medium text-slate-500 mt-3 flex items-center gap-1.5">
                          <Clock size={12} /> {log.response_time_ms}ms
                        </p>
                      )}
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

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Cloud, RefreshCw, Power, ServerCrash, CheckCircle2, AlertCircle, HardDrive, Cpu, Settings2 } from 'lucide-react';

export default function Infra() {
  const [servers, setServers] = useState([]);
  const [loadingHetzner, setLoadingHetzner] = useState(false);
  const [loadingCloudflare, setLoadingCloudflare] = useState(false);
  const [cloudflareMessage, setCloudflareMessage] = useState('');
  const [hetznerError, setHetznerError] = useState('');

  useEffect(() => {
    fetchServers();
  }, []);

  const getHeaders = () => {
    const adminKey = localStorage.getItem('admin_key') || '';
    return { headers: { 'X-Admin-Key': adminKey } };
  };

  const fetchServers = async () => {
    setLoadingHetzner(true);
    setHetznerError('');
    try {
      const res = await axios.get('/api/infra/hetzner/servers', getHeaders());
      setServers(res.data.servers || []);
    } catch (error) {
      console.error("Erro ao carregar servidores Hetzner:", error);
      if (error.response?.status === 400) {
        setHetznerError("Token da Hetzner não configurado. Por favor, adicione-o em 'Configurações Globais'.");
      } else {
        setHetznerError("Erro de conexão com a Hetzner. Verifique se o token é válido.");
      }
    } finally {
      setLoadingHetzner(false);
    }
  };

  const handleServerAction = async (serverId, action) => {
    if (!confirm(`Tem certeza que deseja executar '${action}' no servidor?`)) return;
    
    try {
      await axios.post(`/api/infra/hetzner/servers/${serverId}/action`, { action }, getHeaders());
      alert(`Ação '${action}' enviada com sucesso! O servidor pode levar alguns instantes para reiniciar.`);
      setTimeout(fetchServers, 5000);
    } catch (error) {
      alert("Erro ao executar ação: " + (error.response?.data?.detail || error.message));
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm("Tem certeza? Isso vai limpar todo o cache global do Cloudflare (Purge Everything).")) return;
    
    setLoadingCloudflare(true);
    setCloudflareMessage('');
    try {
      const res = await axios.post('/api/infra/cloudflare/purge-cache', {}, getHeaders());
      setCloudflareMessage(res.data.message || 'Cache limpo com sucesso!');
    } catch (error) {
      setCloudflareMessage("Erro: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingCloudflare(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Infraestrutura em Nuvem</h2>
        <p className="text-slate-500">Gerencie seus servidores na Hetzner e gerencie a propagação de cache via Cloudflare.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* --- Hetzner Panel --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-slate-100 p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 rounded-xl text-red-600">
                <Server size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">Servidores (Hetzner)</h3>
                <p className="text-xs text-slate-500">Instâncias Cloud conectadas</p>
              </div>
            </div>
            <button 
              onClick={fetchServers} 
              className="text-slate-400 hover:text-slate-800 hover:bg-slate-50 p-2 rounded-lg transition-colors"
              disabled={loadingHetzner}
            >
              <RefreshCw size={20} className={loadingHetzner ? 'animate-spin text-blue-500' : ''} />
            </button>
          </div>
          
          <div className="p-5 flex-1 bg-slate-50/50">
            {loadingHetzner && servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-slate-500">Sincronizando com Hetzner...</p>
              </div>
            ) : hetznerError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <Settings2 size={32} className="text-amber-500 mx-auto mb-3" />
                <h4 className="font-semibold text-amber-800 mb-1">Configuração Pendente</h4>
                <p className="text-sm text-amber-700 mb-4">{hetznerError}</p>
                <a href="/admin/config" className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Ir para Configurações
                </a>
              </div>
            ) : servers.length === 0 ? (
              <div className="text-center py-12">
                <Server size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Nenhum servidor encontrado neste projeto Hetzner.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {servers.map(srv => (
                  <div key={srv.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className={`mt-1 flex items-center justify-center w-8 h-8 rounded-full ${srv.status === 'running' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                          {srv.status === 'running' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            {srv.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs font-mono text-slate-500 mt-1">
                            <span className="flex items-center gap-1.5"><HardDrive size={14} className="text-slate-400" /> {srv.public_ip}</span>
                            <span>•</span>
                            <span>{srv.datacenter}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${srv.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {srv.status}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 p-4 flex items-center justify-between gap-4">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">CPU</p>
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Cpu size={14} className="text-blue-500"/> {srv.cores} Cores</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">RAM</p>
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Database size={14} className="text-purple-500"/> {srv.memory} GB</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleServerAction(srv.id, 'reboot')}
                          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          title="Reiniciar Servidor (Soft Reboot)"
                        >
                          <RefreshCw size={14} className="text-amber-500" /> Reboot
                        </button>
                        {srv.status === 'running' ? (
                          <button 
                            onClick={() => handleServerAction(srv.id, 'poweroff')}
                            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-red-600 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            title="Desligar Forçado"
                          >
                            <Power size={14} /> Stop
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleServerAction(srv.id, 'poweron')}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            title="Ligar Servidor"
                          >
                            <ServerCrash size={14} /> Start
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Cloudflare Panel --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-fit overflow-hidden">
          <div className="bg-white border-b border-slate-100 p-5 flex items-center gap-3 shrink-0">
            <div className="p-2.5 bg-orange-50 rounded-xl text-orange-500">
              <Cloud size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">Cloudflare CDN</h3>
              <p className="text-xs text-slate-500">Gerenciamento de Cache Global</p>
            </div>
          </div>
          
          <div className="p-6 bg-slate-50/50 flex-1">
            <div className="bg-white p-5 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-slate-800 mb-2 text-base">Limpeza de Cache (Purge Everything)</h4>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Utilize esta opção para limpar todo o cache estático retido no domínio principal do Cloudflare. 
                Isso é extremamente útil após atualizar ativos de frontend ou scripts em nuvem, garantindo a propagação imediata.
              </p>
              
              <button 
                onClick={handlePurgeCache}
                disabled={loadingCloudflare}
                className="w-full sm:w-auto justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:hover:bg-orange-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow-orange-500/20"
              >
                {loadingCloudflare ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />}
                {loadingCloudflare ? 'Enviando comando...' : 'Limpar Cache Global'}
              </button>
              
              {cloudflareMessage && (
                <div className={`mt-5 p-4 rounded-xl text-sm border font-medium flex items-start gap-3 ${cloudflareMessage.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                  {cloudflareMessage.includes('Erro') ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
                  <div>{cloudflareMessage}</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Cloud, RefreshCw, Power, ServerCrash, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Infra() {
  const [servers, setServers] = useState([]);
  const [loadingHetzner, setLoadingHetzner] = useState(false);
  const [loadingCloudflare, setLoadingCloudflare] = useState(false);
  const [cloudflareMessage, setCloudflareMessage] = useState('');

  useEffect(() => {
    fetchServers();
  }, []);

  const getHeaders = () => {
    const adminKey = localStorage.getItem('admin_key') || '';
    return { headers: { 'X-Admin-Key': adminKey } };
  };

  const fetchServers = async () => {
    setLoadingHetzner(true);
    try {
      const res = await axios.get('/api/infra/hetzner/servers', getHeaders());
      setServers(res.data.servers || []);
    } catch (error) {
      console.error("Erro ao carregar servidores Hetzner:", error);
    } finally {
      setLoadingHetzner(false);
    }
  };

  const handleServerAction = async (serverId, action) => {
    if (!confirm(`Tem certeza que deseja executar '${action}' no servidor?`)) return;
    
    try {
      await axios.post(`/api/infra/hetzner/servers/${serverId}/action`, { action }, getHeaders());
      alert(`Ação '${action}' enviada com sucesso! O servidor pode levar alguns instantes para reiniciar.`);
      // Refetch after a small delay
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
    <div className="max-w-6xl">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Infraestrutura ☁️</h2>
        <p className="text-slate-500">Gerencie servidores da Hetzner e cache do Cloudflare.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- Hetzner Panel --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Server size={20} className="text-red-500" /> Servidores (Hetzner)
            </div>
            <button onClick={fetchServers} className="text-slate-500 hover:text-slate-800" disabled={loadingHetzner}>
              <RefreshCw size={18} className={loadingHetzner ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="p-4">
            {loadingHetzner && servers.length === 0 ? (
              <p className="text-sm text-slate-500">Carregando dados da Hetzner...</p>
            ) : servers.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum servidor encontrado ou chave HETZNER_API_TOKEN não configurada no backend.</p>
            ) : (
              <div className="space-y-4">
                {servers.map(srv => (
                  <div key={srv.id} className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          {srv.name}
                          {srv.status === 'running' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-amber-500" />}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono mt-1">{srv.public_ip} • {srv.datacenter}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${srv.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {srv.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 mb-4 text-sm text-slate-600">
                      <div className="bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm flex-1 text-center">
                        <strong className="block text-slate-800">{srv.cores}</strong> Cores
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm flex-1 text-center">
                        <strong className="block text-slate-800">{srv.memory} GB</strong> RAM
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleServerAction(srv.id, 'reboot')}
                        className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        <RefreshCw size={14} /> Reboot
                      </button>
                      <button 
                        onClick={() => handleServerAction(srv.id, 'poweroff')}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        <Power size={14} /> Power Off
                      </button>
                      <button 
                        onClick={() => handleServerAction(srv.id, 'poweron')}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        <ServerCrash size={14} /> Power On
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Cloudflare Panel --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-2 text-slate-800 font-bold">
            <Cloud size={20} className="text-orange-500" /> Cloudflare
          </div>
          
          <div className="p-6">
            <h3 className="font-bold text-slate-800 mb-2">Limpeza de Cache (Purge Everything)</h3>
            <p className="text-sm text-slate-500 mb-4">
              Limpa todo o cache estático do domínio principal do Cloudflare (necessário configurar CLOUDFLARE_ZONE_ID e CLOUDFLARE_API_TOKEN no servidor).
              Útil após atualizar assets ou o frontend na nuvem para forçar a propagação imediata.
            </p>
            
            <button 
              onClick={handlePurgeCache}
              disabled={loadingCloudflare}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              {loadingCloudflare ? <RefreshCw size={18} className="animate-spin" /> : <Cloud size={18} />}
              Limpar Cache Global
            </button>
            
            {cloudflareMessage && (
              <div className={`mt-4 p-3 rounded text-sm border ${cloudflareMessage.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                {cloudflareMessage}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

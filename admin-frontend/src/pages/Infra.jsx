import { useState, useEffect } from 'react';
import { Server, Settings, RefreshCw, Key, Cpu, HardDrive, Cloud, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function Infra() {
  const [servers, setServers] = useState([]);
  const [loadingHetzner, setLoadingHetzner] = useState(false);
  const [hetznerError, setHetznerError] = useState(null);
  const [hasHetznerKey, setHasHetznerKey] = useState(true); // default true para não piscar o erro antes de checar

  const fetchServers = async () => {
    setLoadingHetzner(true);
    setHetznerError(null);
    try {
      const response = await fetch('/api/infra/hetzner/servers');
      if (response.status === 400) {
        setHasHetznerKey(false);
        setServers([]);
        return;
      }
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao buscar servidores Hetzner');
      }
      
      setHasHetznerKey(true);
      setServers(data.servers || []);
    } catch (error) {
      console.error(error);
      setHetznerError(error.message);
    } finally {
      setLoadingHetzner(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  return (
    <div className="space-y-6 text-slate-200">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Infraestrutura em Nuvem</h2>
        <p className="text-slate-400">Gerencie seus servidores na Hetzner e gerencie a propagação de cache via Cloudflare.</p>
      </div>

      {/* Alerta de chave ausente (Hetzner) */}
      {!hasHetznerKey && (
        <div className="glass-panel border-amber-500/30 bg-amber-500/10 p-5 rounded-2xl flex items-start gap-4 shadow-lg shadow-amber-500/5">
          <div className="text-amber-400 mt-1">
            <Settings size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-400 mb-1">Configuração da Hetzner Ausente</h3>
            <p className="text-sm text-slate-300">
              O token da API da Hetzner não foi encontrado no arquivo de ambiente (HETZNER_API_TOKEN ou HETZNER-API-TOKEN).
            </p>
            <div className="mt-4">
              <Link 
                to="/config" 
                className="inline-flex items-center gap-2 bg-amber-500 text-slate-900 font-semibold px-4 py-2 rounded-lg hover:bg-amber-400 transition-colors"
              >
                Configurar Variáveis
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hetzner Section */}
      <div className="glass-panel rounded-2xl overflow-hidden mt-6">
        <div className="p-6 border-b border-white/10 glass-header flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Server size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Servidores (Hetzner)</h3>
              <p className="text-sm text-slate-400">Instâncias Cloud conectadas</p>
            </div>
          </div>
          <button 
            onClick={fetchServers}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/20"
            title="Atualizar dados"
            disabled={loadingHetzner}
          >
            <RefreshCw size={20} className={loadingHetzner ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="p-6">
          {loadingHetzner ? (
            <div className="flex flex-col justify-center items-center h-32 space-y-3">
               <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-slate-400 font-medium animate-pulse">Conectando à Hetzner Cloud...</p>
            </div>
          ) : hetznerError ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 text-center flex flex-col items-center">
              <Key size={32} className="text-amber-400 mb-3" />
              <p className="text-amber-400 font-semibold mb-1">Configuração Pendente</p>
              <p className="text-slate-300 text-sm mb-4">Erro de conexão com a Hetzner. Verifique se o token é válido.</p>
              <Link to="/config" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-2 px-6 rounded-lg transition-colors">
                Ir para Configurações
              </Link>
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Nenhum servidor encontrado neste projeto da Hetzner.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {servers.map(server => (
                <div key={server.id} className="border border-white/10 rounded-xl p-5 hover:bg-white/5 transition-colors group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${server.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                      <div>
                        <h4 className="font-bold text-white text-base group-hover:text-brand-400 transition-colors">{server.name}</h4>
                        <p className="text-xs text-slate-400">{server.public_ip || 'Sem IP Público'}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-white/10 text-slate-300 text-[10px] font-bold rounded uppercase tracking-wider border border-white/5">
                      {server.server_type}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Cpu size={14} /> <span className="text-xs font-semibold uppercase tracking-wider">Cores</span>
                      </div>
                      <p className="font-medium text-white">{server.cores} vCPU</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <HardDrive size={14} /> <span className="text-xs font-semibold uppercase tracking-wider">RAM / Disco</span>
                      </div>
                      <p className="font-medium text-white">{server.memory}GB / {server.disk}GB</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-lg text-sm border border-white/10 transition-colors">
                      Reiniciar
                    </button>
                    <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-lg text-sm border border-white/10 transition-colors">
                      Console
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cloudflare Section */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10 glass-header flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
              <Cloud size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Cloudflare CDN</h3>
              <p className="text-sm text-slate-400">Gerenciamento de Cache Global</p>
            </div>
          </div>
          <button 
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/20"
            title="Atualizar Status"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="bg-black/20 border border-white/5 rounded-xl p-8 text-center flex flex-col items-center">
             <Globe size={32} className="text-slate-500 mb-3" />
             <p className="text-slate-300 font-medium">Integração com Cloudflare não ativada.</p>
             <p className="text-sm text-slate-500 mt-1 mb-4">Adicione as credenciais no menu de Configurações para habilitar a purga de cache diretamente pelo painel.</p>
             <button className="px-4 py-2 bg-white/5 text-slate-300 rounded-lg text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors">
               Ativar Cloudflare
             </button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Infra;

import { useState, useEffect } from 'react';
import { Server, Settings, RefreshCw, Key, Cpu, HardDrive, Cloud, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function Infra() {
  const [servers, setServers] = useState([]);
  const [loadingHetzner, setLoadingHetzner] = useState(false);
  const [hetznerError, setHetznerError] = useState(null);
  const [hasHetznerKey, setHasHetznerKey] = useState(true);
  const [cloudflareStatus, setCloudflareStatus] = useState({ r2_active: false, cdn_active: false });
  const [loadingCloudflare, setLoadingCloudflare] = useState(false);
  const [purgingCache, setPurgingCache] = useState(false);

  const fetchServers = async () => {
    setLoadingHetzner(true);
    setHetznerError(null);
    try {
      const response = await axios.get('/api/infra/hetzner/servers');
      if (response.status === 400) {
        setHasHetznerKey(false);
        setServers([]);
        return;
      }
      
      const data = response.data;
      if (response.status !== 200) {
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

  const fetchCloudflareStatus = async () => {
    setLoadingCloudflare(true);
    try {
      const response = await axios.get('/api/infra/cloudflare/status');
      if (response.status === 200) {
        const data = response.data;
        setCloudflareStatus(data);
      }
    } catch (error) {
      console.error("Erro ao buscar status do Cloudflare:", error);
    } finally {
      setLoadingCloudflare(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm("Tem certeza que deseja purgar o cache global da CDN? Isso pode aumentar a carga no servidor temporariamente.")) return;
    setPurgingCache(true);
    try {
      const response = await axios.post('/api/infra/cloudflare/purge-cache');
      if (response.status === 200) {
        alert("Cache global do Cloudflare purgado com sucesso!");
      } else {
        const err = await response.json();
        alert("Erro ao purgar cache: " + err.detail);
      }
    } catch (error) {
      alert("Erro de conexão ao tentar purgar cache: " + error.message);
    } finally {
      setPurgingCache(false);
    }
  };

  useEffect(() => {
    fetchServers();
    fetchCloudflareStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Infraestrutura em Nuvem</h2>
        <p className="text-slate-500">Gerencie seus servidores na Hetzner e gerencie a propagação de cache via Cloudflare.</p>
      </div>

      {/* Alerta de chave ausente (Hetzner) */}
      {!hasHetznerKey && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="text-amber-500 mt-1">
            <Settings size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-800 mb-1">Configuração da Hetzner Ausente</h3>
            <p className="text-sm text-amber-700">
              O token da API da Hetzner não foi encontrado no arquivo de ambiente (HETZNER_API_TOKEN ou HETZNER-API-TOKEN).
            </p>
            <div className="mt-4">
              <Link 
                to="/config" 
                className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
              >
                Configurar Variáveis
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hetzner Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Server size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Servidores (Hetzner)</h3>
              <p className="text-sm text-slate-500">Instâncias Cloud conectadas</p>
            </div>
          </div>
          <button 
            onClick={fetchServers}
            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors border border-transparent hover:border-brand-100"
            title="Atualizar dados"
            disabled={loadingHetzner}
          >
            <RefreshCw size={20} className={loadingHetzner ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="p-6 bg-slate-50">
          {loadingHetzner ? (
            <div className="flex flex-col justify-center items-center h-32 space-y-3">
               <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-slate-500 font-medium animate-pulse">Conectando à Hetzner Cloud...</p>
            </div>
          ) : hetznerError ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
              <Key size={32} className="text-amber-500 mb-3" />
              <p className="text-slate-900 font-semibold mb-1">Configuração Pendente</p>
              <p className="text-slate-500 text-sm mb-4">Erro de conexão com a Hetzner. Verifique se o token é válido.</p>
              <Link to="/config" className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                Ir para Configurações
              </Link>
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Nenhum servidor encontrado neste projeto da Hetzner.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {servers.map(server => (
                <div key={server.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${server.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base group-hover:text-brand-600 transition-colors">{server.name}</h4>
                        <p className="text-xs text-slate-500">{server.public_ip || 'Sem IP Público'}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">
                      {server.server_type}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Cpu size={14} /> <span className="text-xs font-semibold uppercase tracking-wider">Cores</span>
                      </div>
                      <p className="font-medium text-slate-900">{server.cores} vCPU</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <HardDrive size={14} /> <span className="text-xs font-semibold uppercase tracking-wider">RAM / Disco</span>
                      </div>
                      <p className="font-medium text-slate-900">{server.memory}GB / {server.disk}GB</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-sm border border-slate-200 transition-colors">
                      Reiniciar
                    </button>
                    <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-sm border border-slate-200 transition-colors">
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-500 rounded-xl border border-orange-100">
              <Cloud size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Ecossistema Cloudflare</h3>
              <p className="text-sm text-slate-500">Gerenciamento de Cache Global e R2 Storage</p>
            </div>
          </div>
          <button 
            onClick={fetchCloudflareStatus}
            disabled={loadingCloudflare}
            className={`p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors border border-transparent hover:border-brand-100 ${loadingCloudflare ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Atualizar Status"
          >
            <RefreshCw size={20} className={loadingCloudflare ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="p-6 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* R2 Storage Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
              <HardDrive size={32} className={cloudflareStatus.r2_active ? "text-emerald-500 mb-3" : "text-slate-400 mb-3"} />
              <h4 className="font-bold text-slate-900 mb-1">R2 Object Storage</h4>
              {cloudflareStatus.r2_active ? (
                <>
                  <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    <CheckCircle2 size={14} /> Ativo
                  </div>
                  <p className="text-sm text-slate-500">Armazenamento de documentos RAG está usando o Cloudflare R2.</p>
                </>
              ) : (
                <>
                  <p className="text-slate-900 font-medium text-sm">Integração não ativada.</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Adicione as chaves R2 (Access Key, Secret) nas Configurações.</p>
                  <Link to="/config" className="px-4 py-2 bg-white text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors">
                    Configurar R2
                  </Link>
                </>
              )}
            </div>

            {/* CDN Cache Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
              <Globe size={32} className={cloudflareStatus.cdn_active ? "text-brand-500 mb-3" : "text-slate-400 mb-3"} />
              <h4 className="font-bold text-slate-900 mb-1">CDN Global Cache</h4>
              {cloudflareStatus.cdn_active ? (
                <>
                  <div className="flex items-center gap-1.5 text-brand-600 bg-brand-50 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    <CheckCircle2 size={14} /> Ativo
                  </div>
                  <p className="text-sm text-slate-500 mb-4">A purga de cache global está habilitada para a sua Zona.</p>
                  <button 
                    onClick={handlePurgeCache}
                    disabled={purgingCache}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {purgingCache ? 'Purgando...' : 'Purgar Cache Agora'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-slate-900 font-medium text-sm">Integração não ativada.</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Adicione o Zone ID e Token da API nas Configurações.</p>
                  <Link to="/config" className="px-4 py-2 bg-white text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors">
                    Configurar CDN
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}

export default Infra;

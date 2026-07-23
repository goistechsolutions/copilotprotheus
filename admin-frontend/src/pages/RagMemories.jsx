import { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import { Database, Brain, Play, FileText, UploadCloud, Search, RefreshCw, XCircle } from 'lucide-react';

export default function RagMemories() {
  const [activeTab, setActiveTab] = useState('rag');
  const [docs, setDocs] = useState([]);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('default');
  const [visibility, setVisibility] = useState('tenant');
  const fileInputRef = useRef(null);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' },
    headers: { 'X-Tenant-Id': selectedTenant }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedTenant, visibility]);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/tenants');
      setTenants(res.data || []);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rag') {
        const endpoint = visibility === 'shared' ? '/api/knowledge/documents/shared' : '/api/knowledge/documents';
        const res = await axios.get(endpoint);
        setDocs(res.data.items || []);
      } else {
        const res = await axios.get('/api/knowledge/memories');
        let mems = res.data.items || [];
        if (visibility === 'shared') {
          mems = mems.filter(m => m.visibility === 'shared');
        } else {
          mems = mems.filter(m => m.visibility === 'tenant');
        }
        setMemories(mems);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await axios.post(`/api/knowledge/ingest?visibility=${visibility}`, {});
      alert("Ingestão concluída com sucesso! Os vetores foram atualizados.");
      fetchData();
    } catch (error) {
      alert("Erro durante ingestão.");
    } finally {
      setIngesting(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      await axios.post(`/api/knowledge/upload?visibility=${visibility}`, formData, {
        ...axiosConfig,
        headers: { ...axiosConfig.headers, 'Content-Type': 'multipart/form-data' }
      });
      alert(`Arquivo ${file.name} processado e ingerido na base RAG!`);
      fetchData();
    } catch (error) {
      alert(`Falha no upload do arquivo ${file.name}.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const syntheticEvent = { target: { files: [files[0]] } };
      handleFileUpload(syntheticEvent);
    }
  };

  const handleDeleteMemory = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta memória permanentemente?")) return;
    try {
      await axios.delete(`/api/knowledge/memories/${id}`);
      alert("Memória excluída com sucesso.");
      fetchData();
    } catch (error) {
      alert("Erro ao excluir memória. " + (error.response?.data?.detail || ""));
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este documento (e seus vetores) permanentemente?")) return;
    try {
      await axios.delete(`/api/knowledge/documents/${id}`);
      alert("Documento excluído com sucesso.");
      fetchData();
    } catch (error) {
      alert("Erro ao excluir documento. " + (error.response?.data?.detail || ""));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">RAG & Inteligência</h2>
          <p className="text-slate-500">Gerencie a base de conhecimento (PDF/TXT) e os fatos persistentes aprendidos pelo LLM.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Visibilidade</label>
            <select 
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="tenant">Exclusiva (Tenant)</option>
              <option value="shared">Compartilhada (Global)</option>
            </select>
          </div>
          {visibility === 'tenant' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tenant Atual</label>
              <select 
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm min-w-[200px]"
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
              >
                <option value="default">Default</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('rag')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'rag' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'}`}
        >
          <Database size={16} /> Base RAG (Documentos)
          {activeTab === 'rag' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('memories')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-all relative ${activeTab === 'memories' ? 'text-purple-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'}`}
        >
          <Brain size={16} /> Memórias (Aprendizado Contínuo)
          {activeTab === 'memories' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 rounded-t-full"></span>}
        </button>
      </div>

      {activeTab === 'rag' && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div 
            className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-8 text-center hover:bg-slate-50 hover:border-brand-400 transition-colors cursor-pointer relative shadow-sm"
            onClick={triggerFileSelect}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.txt,.md,.csv,.doc,.docx" 
            />
            
            <div className="flex justify-center mb-3">
              <div className="p-4 bg-brand-50 shadow-sm rounded-full text-brand-600 border border-brand-100">
                {uploading ? <RefreshCw className="animate-spin" size={32} /> : <UploadCloud size={32} />}
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {uploading ? 'Enviando e Ingerindo Arquivo...' : 'Clique ou Arraste arquivos aqui'}
            </h3>
            <p className="text-sm text-slate-500">Suporta arquivos PDF, TXT, MD e CSV.</p>
            <p className="text-xs font-bold text-brand-700 mt-4 px-4 py-1.5 bg-brand-50 inline-block rounded-full border border-brand-200">
              Os arquivos enviados são automaticamente adicionados à base vetorial.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Documentos Indexados (pgvector)</h3>
              </div>
              <button 
                onClick={handleIngest}
                disabled={ingesting}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm shadow-sm w-full sm:w-auto justify-center"
              >
                {ingesting ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                {ingesting ? "Forçando Ingestão..." : "Forçar Ingestão (Resync)"}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">ID</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Arquivo Fonte</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Visibilidade</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Formato</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Data de Ingestão</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="7" className="p-8 text-center text-slate-500 animate-pulse font-medium">Carregando documentos...</td></tr>
                  ) : docs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center flex flex-col items-center">
                        <FileText size={48} className="text-slate-300 mb-4 opacity-50" />
                        <p className="text-slate-500 font-medium">Sua base de conhecimento está vazia.</p>
                      </td>
                    </tr>
                  ) : (
                    docs.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">#{doc.id}</td>
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                          <div className="p-2 bg-brand-50 text-brand-600 rounded-lg border border-brand-100"><FileText size={16} /></div>
                          {doc.title || doc.source_path}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-bold border rounded-md ${doc.visibility === 'shared' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                            {doc.visibility === 'shared' ? 'Global' : 'Tenant'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                            {doc.source_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Indexado
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-medium text-right">
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100" 
                            title="Excluir Documento"
                          >
                            <XCircle size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memories' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Fatos e Preferências Extraídas</h3>
              <p className="text-sm text-slate-500">Memórias persistentes de longo prazo que orientam o Copilot.</p>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar memória..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-full sm:w-64 transition-all"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tenant (Empresa)</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tópico (Chave)</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Fato Aprendido</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Confiança</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-500 animate-pulse font-medium">Carregando memórias...</td></tr>
                ) : memories.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center flex flex-col items-center">
                      <Brain size={48} className="text-slate-300 mb-4 opacity-50" />
                      <p className="text-slate-500 font-medium">Nenhum fato aprendido ainda.</p>
                      <p className="text-sm text-slate-400 mt-1">O Copilot extrai essas informações dinamicamente das conversas.</p>
                    </td>
                  </tr>
                ) : (
                  memories.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {m.tenant_id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md text-sm border border-purple-200">
                          {m.memory_key}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-medium max-w-sm">
                        {m.memory_value}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${m.confidence >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                              style={{ width: `${m.confidence}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{m.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteMemory(m.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100" 
                          title="Esquecer Fato"
                        >
                          <XCircle size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

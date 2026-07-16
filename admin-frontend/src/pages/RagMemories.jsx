import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Brain, Play, FileText, UploadCloud } from 'lucide-react';

export default function RagMemories() {
  const [activeTab, setActiveTab] = useState('rag');
  const [docs, setDocs] = useState([]);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' },
    headers: { 'X-Tenant-Id': 'default' }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rag') {
        const res = await axios.get('/api/knowledge/documents', axiosConfig);
        setDocs(res.data.items || []);
      } else {
        const res = await axios.get('/api/knowledge/memories', axiosConfig);
        setMemories(res.data.items || []);
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
      await axios.post('/api/knowledge/ingest', {}, axiosConfig);
      alert("Ingestão concluída com sucesso!");
      fetchData();
    } catch (error) {
      alert("Erro durante ingestão.");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">RAG & Memórias de Longo Prazo</h2>
        <p className="text-slate-500">Gerencie a base de conhecimento vetorial (pgvector) e as memórias extraídas automaticamente pela IA.</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('rag')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === 'rag' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Database size={18} /> Base RAG (Documentos)
        </button>
        <button 
          onClick={() => setActiveTab('memories')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${activeTab === 'memories' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Brain size={18} /> Memórias (LLM)
        </button>
      </div>

      {activeTab === 'rag' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Documentos Ingeridos</h3>
            <button 
              onClick={handleIngest}
              disabled={ingesting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              {ingesting ? <UploadCloud className="animate-bounce" size={16} /> : <Play size={16} />}
              {ingesting ? "Processando..." : "Disparar Ingestão Geral"}
            </button>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">ID</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Título / Arquivo</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Tipo</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Carregando...</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Nenhum documento na base de dados.</td></tr>
              ) : (
                docs.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm text-slate-500">{doc.id}</td>
                    <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      {doc.title || doc.source_path}
                    </td>
                    <td className="p-4 text-sm text-slate-600">{doc.source_type}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">Indexado</span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{new Date(doc.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'memories' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-700">Fatos e Preferências do Usuário</h3>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">Tenant</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Chave de Memória</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Valor Aprendido</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500">Carregando...</td></tr>
              ) : memories.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500">Nenhuma memória salva ainda.</td></tr>
              ) : (
                memories.map(m => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm font-mono text-slate-500">{m.tenant_id}</td>
                    <td className="p-4 text-sm font-semibold text-purple-700">{m.memory_key}</td>
                    <td className="p-4 text-sm text-slate-700">{m.memory_value}</td>
                    <td className="p-4 text-sm text-slate-500">{m.confidence}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

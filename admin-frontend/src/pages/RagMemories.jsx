import { useState } from 'react';
import { RefreshCw, Upload, Trash2, FileText, BookOpen, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApi, apiCall } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import DataTable from '../components/ui/DataTable';

function UploadModal({ onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [tenantId, setTenantId] = useState('default');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setErr(''); setOk(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tenant_id', tenantId);
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.detail || 'Erro no upload'); }
      setOk(true);
      setTimeout(() => { onSaved(); }, 1200);
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2535]">
          <h2 className="text-white font-semibold">Upload de Documento</h2>
          <button onClick={onClose} className="text-[#8892A4] hover:text-white">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <form onSubmit={upload} className="p-6 space-y-4">
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Tenant ID</label>
            <input value={tenantId} onChange={e => setTenantId(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#2196F3] transition-all"
              placeholder="default" />
          </div>
          <div>
            <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Arquivo</label>
            <div
              className="border-2 border-dashed border-[#1E2535] rounded-xl p-6 text-center cursor-pointer hover:border-[#2196F3]/50 transition-all"
              onClick={() => document.getElementById('rag-file').click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-[#2196F3]">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-[#8892A4]">
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Clique para selecionar</p>
                  <p className="text-xs mt-1">.pdf, .txt, .docx, .md</p>
                </div>
              )}
              <input id="rag-file" type="file" className="hidden" accept=".pdf,.txt,.docx,.md"
                onChange={e => setFile(e.target.files[0])} />
            </div>
          </div>
          {err && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{err}
          </div>}
          {ok && <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />Documento indexado com sucesso!
          </div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8892A4] hover:text-white border border-[#1E2535] rounded-lg transition-all">Cancelar</button>
            <button type="submit" disabled={uploading || !file} className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1565C0] hover:bg-[#1976D2] text-white rounded-lg font-medium transition-all disabled:opacity-60">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Enviando...' : 'Fazer Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RagMemories() {
  const { data, loading, refetch } = useApi('/api/knowledge/documents');
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const docs = Array.isArray(data) ? data : (data?.documents ?? data?.items ?? []);

  const deleteDoc = async (id) => {
    if (!confirm('Remover este documento da base RAG?')) return;
    setDeleting(id);
    try { await apiCall(`/api/knowledge/documents/${id}`, 'DELETE'); refetch(); }
    catch (e) { alert(e.message); }
    finally { setDeleting(null); }
  };

  const columns = [
    {
      key: 'filename', label: 'Arquivo',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1565C0]/10 rounded-lg flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-[#2196F3]" />
          </div>
          <span className="text-white text-sm font-medium">{v || row.title || row.name || '—'}</span>
        </div>
      )
    },
    { key: 'tenant_id', label: 'Tenant', render: v => <Badge variant="default">{v || 'default'}</Badge> },
    { key: 'visibility', label: 'Visibilidade', render: v => <Badge variant={v === 'global' ? 'green' : 'blue'}>{v || 'tenant'}</Badge> },
    {
      key: 'chunk_count', label: 'Chunks',
      render: v => <span className="text-[#8892A4] text-sm">{v ?? '—'}</span>
    },
    {
      key: 'created_at', label: 'Indexado em',
      render: v => v ? <span className="text-[#8892A4] text-xs">{new Date(v).toLocaleDateString('pt-BR')}</span> : '—'
    },
    {
      key: 'id', label: 'Ações',
      render: (id) => (
        <button
          onClick={() => deleteDoc(id)}
          disabled={deleting === id}
          className="p-1.5 text-[#8892A4] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all disabled:opacity-40"
        >
          {deleting === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Base de Conhecimento"
        description="Documentos indexados no RAG vector store"
        actions={
          <>
            <button onClick={refetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 px-3 py-2 bg-[#1565C0] hover:bg-[#1976D2] text-white text-sm font-medium rounded-lg transition-all">
              <Upload className="w-4 h-4" /> Upload Doc
            </button>
          </>
        }
      />

      {docs.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#2196F3]" />
          <span className="text-[#8892A4] text-sm">{docs.length} documento{docs.length !== 1 ? 's' : ''} na base</span>
        </div>
      )}

      {loading ? (
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={docs} />
      )}

      {modal && <UploadModal onClose={() => setModal(false)} onSaved={() => { setModal(false); refetch(); }} />}
    </div>
  );
}

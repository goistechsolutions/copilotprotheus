import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, FileText, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import DataTable from '../components/ui/DataTable';

function listFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function tenantValue(tenant) {
  return String(tenant?.tenant_code || tenant?.id || '');
}

function UploadModal({ tenants, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [tenantId, setTenantId] = useState(tenants.length === 1 ? tenantValue(tenants[0]) : '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const upload = async event => {
    event.preventDefault();
    if (!file || !tenantId) {
      setError('Selecione um tenant e um arquivo antes de continuar.');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/knowledge/upload', { method: 'POST', headers: { 'X-Tenant-ID': tenantId }, credentials: 'include', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Não foi possível indexar o documento.');
      setSuccess(true);
      window.setTimeout(onSaved, 900);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível indexar o documento.');
    } finally {
      setUploading(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-[#2B3850] bg-[#161B27] shadow-2xl"><div className="flex items-center justify-between border-b border-[#1E2A3D] px-6 py-4"><div><h2 className="text-base font-semibold text-white">Adicionar documento ao RAG</h2><p className="mt-1 text-xs text-[#94A3B8]">O documento será indexado somente no tenant selecionado.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#1E2535] hover:text-white"><X className="h-5 w-5" /></button></div><form onSubmit={upload} className="space-y-4 p-6">
    <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Tenant *</span><select value={tenantId} onChange={event => setTenantId(event.target.value)} disabled={uploading} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA] disabled:opacity-60"><option value="">Selecione um tenant</option>{tenants.map(tenant => { const value = tenantValue(tenant); return <option key={value} value={value}>{tenant.tenant_name || tenant.name || value}</option>; })}</select></label>
    <div><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Arquivo *</span><label htmlFor="rag-file" className="block cursor-pointer rounded-xl border-2 border-dashed border-[#2B3850] p-7 text-center transition hover:border-[#60A5FA]/60 hover:bg-[#0F172A]"><input id="rag-file" type="file" className="sr-only" accept=".pdf,.txt,.docx,.md" onChange={event => setFile(event.target.files?.[0] || null)} />{file ? <div className="flex items-center justify-center gap-2 text-[#60A5FA]"><FileText className="h-5 w-5" /><span className="text-sm font-medium">{file.name}</span></div> : <div className="text-[#94A3B8]"><Upload className="mx-auto mb-2 h-6 w-6" /><p className="text-sm">Selecione um PDF, TXT, DOCX ou Markdown</p><p className="mt-1 text-xs text-[#64748B]">Use somente documentos autorizados para este tenant.</p></div>}</label></div>
    {error && <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {success && <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />Documento aceito para indexação.</div>}
    <div className="flex justify-end gap-2 border-t border-[#1E2A3D] pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-[#2B3850] px-4 py-2 text-sm text-[#CBD5E1] transition hover:bg-[#1E2535] hover:text-white">Cancelar</button><button type="submit" disabled={uploading || !file || !tenantId} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? 'Indexando…' : 'Indexar documento'}</button></div>
  </form></div></div>;
}

export default function RagMemories() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadTenants = async () => {
    try {
      const response = await api.get('/api/tenants');
      const tenantList = listFrom(response.data, ['tenants', 'items']);
      setTenants(tenantList);
      if (tenantList.length === 1) setSelectedTenant(tenantValue(tenantList[0]));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar os tenants para consultar a base RAG.');
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadDocuments = async (tenant = selectedTenant) => {
    if (!tenant) {
      setDocs([]);
      return;
    }
    setLoadingDocs(true);
    setError('');
    try {
      const response = await api.get('/api/knowledge/documents', { headers: { 'X-Tenant-ID': tenant } });
      setDocs(listFrom(response.data, ['documents', 'items']));
    } catch (requestError) {
      setDocs([]);
      setError(requestError.response?.data?.detail || 'Não foi possível carregar os documentos desta base RAG.');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);
  useEffect(() => { if (selectedTenant) loadDocuments(selectedTenant); else setDocs([]); }, [selectedTenant]);

  const deleteDoc = async id => {
    if (!window.confirm('Remover este documento da base RAG?')) return;
    setDeleting(id);
    setError('');
    setNotice('');
    try {
      await api.delete(`/api/knowledge/documents/${id}`, { headers: { 'X-Tenant-ID': selectedTenant } });
      setNotice('Documento removido da base RAG.');
      await loadDocuments(selectedTenant);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível remover o documento.');
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    { key: 'filename', label: 'Arquivo', render: (value, row) => <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1565C0]/15 text-[#60A5FA]"><FileText className="h-4 w-4" /></div><span className="text-sm font-medium text-white">{value || row.title || row.name || 'Arquivo sem nome'}</span></div> },
    { key: 'tenant_id', label: 'Tenant', render: value => <Badge variant="default">{value || 'Não informado'}</Badge> },
    { key: 'visibility', label: 'Visibilidade', render: value => <Badge variant={value === 'global' ? 'green' : 'blue'}>{value || 'Não informada'}</Badge> },
    { key: 'chunk_count', label: 'Chunks', render: value => <span className="text-sm text-[#CBD5E1]">{value ?? '—'}</span> },
    { key: 'created_at', label: 'Indexado em', render: value => <span className="text-xs text-[#94A3B8]">{value ? new Date(value).toLocaleDateString('pt-BR') : '—'}</span> },
    { key: 'id', label: 'Ações', render: id => <button type="button" onClick={() => deleteDoc(id)} disabled={deleting === id} title="Remover documento" className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-40">{deleting === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button> },
  ];

  return <div className="space-y-6"><PageHeader title="Base de conhecimento" description="Documentos indexados no RAG vector store, separados por tenant." actions={<><button type="button" onClick={() => { loadTenants(); if (selectedTenant) loadDocuments(selectedTenant); }} className="rounded-lg border border-[#2B3850] p-2 text-[#94A3B8] transition hover:bg-[#1E2535] hover:text-white" title="Atualizar"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={() => setModal(true)} disabled={loadingTenants || !tenants.length} className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />Adicionar documento</button></>} />
    <section className="flex flex-col gap-3 rounded-xl border border-[#2B3850] bg-[#161B27] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]">Escopo da base</p><p className="mt-1 text-xs text-[#64748B]">A consulta envia o identificador no header X-Tenant-ID.</p></div><select value={selectedTenant} onChange={event => setSelectedTenant(event.target.value)} disabled={loadingTenants} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA] sm:max-w-xs"><option value="">{loadingTenants ? 'Carregando tenants…' : 'Selecione um tenant'}</option>{tenants.map(tenant => { const value = tenantValue(tenant); return <option key={value} value={value}>{tenant.tenant_name || tenant.name || value}</option>; })}</select></section>
    {(error) && <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
    {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {selectedTenant && docs.length > 0 && <div className="flex items-center gap-2 text-sm text-[#94A3B8]"><BookOpen className="h-4 w-4 text-[#60A5FA]" />{docs.length} documento{docs.length === 1 ? '' : 's'} retornado{docs.length === 1 ? '' : 's'} para <span className="font-mono text-white">{selectedTenant}</span></div>}
    {!selectedTenant ? <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#2B3850] bg-[#111827]/60 px-6 text-center"><BookOpen className="mb-3 h-9 w-9 text-[#334155]" /><h2 className="text-sm font-semibold text-white">Selecione um tenant</h2><p className="mt-1 max-w-md text-xs leading-5 text-[#94A3B8]">A base RAG é isolada por tenant. O painel não consulta nem exibe documentos sem um escopo explícito.</p></div> : loadingDocs ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[#1E2A3D] bg-[#161B27]"><RefreshCw className="h-6 w-6 animate-spin text-[#60A5FA]" /></div> : <DataTable columns={columns} data={docs} emptyMessage="Nenhum documento foi retornado para este tenant." />}
    {modal && <UploadModal tenants={tenants} onClose={() => setModal(false)} onSaved={() => { setModal(false); setNotice('Documento enviado para indexação.'); loadDocuments(selectedTenant); }} />}
  </div>;
}

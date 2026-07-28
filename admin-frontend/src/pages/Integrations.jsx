import { useState } from 'react';
import { BarChart2, Image, RefreshCw, Play, Loader2, CheckCircle2, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { apiCall } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

/* ═══════════════════ POWER BI PANEL ═══════════════════ */
function PowerBIPanel() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [reportId, setReportId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const getEmbedToken = async () => {
    if (!workspaceId || !reportId) return;
    setLoading(true); setErr(''); setEmbedData(null);
    try {
      const d = await apiCall('/api/powerbi/embed-token', 'POST', {
        workspace_id: workspaceId,
        report_id: reportId,
        dataset_id: datasetId || undefined,
      });
      setEmbedData(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const triggerRefresh = async () => {
    if (!workspaceId || !datasetId) { setErr('Informe Workspace ID e Dataset ID para refresh'); return; }
    setRefreshing(true); setErr('');
    try {
      await apiCall(`/api/powerbi/refresh/${workspaceId}/${datasetId}`, 'POST');
      alert('✅ Refresh de dataset disparado com sucesso!');
    } catch (e) { setErr(e.message); }
    finally { setRefreshing(false); }
  };

  const F = ({ label, value, onChange, placeholder }) => (
    <div>
      <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all" />
    </div>
  );

  return (
    <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#F2C811]/10 rounded-xl flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#F2C811]" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Microsoft Power BI</h3>
          <p className="text-[#8892A4] text-xs">Embed de relatórios e refresh de datasets</p>
        </div>
        <Badge variant="yellow" className="ml-auto">REST v1</Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Workspace ID" value={workspaceId} onChange={setWorkspaceId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <F label="Report ID"    value={reportId}    onChange={setReportId}    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <F label="Dataset ID (opcional — para refresh)" value={datasetId} onChange={setDatasetId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />

        {err && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{err}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={getEmbedToken} disabled={loading || !workspaceId || !reportId}
            className="flex items-center gap-2 px-4 py-2 bg-[#F2C811] hover:bg-[#F2C811]/80 text-black text-sm font-medium rounded-lg transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Gerando...' : 'Gerar Embed Token'}
          </button>
          <button onClick={triggerRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E2535] hover:bg-[#1565C0]/20 text-[#8892A4] hover:text-white text-sm font-medium rounded-lg border border-[#1E2535] hover:border-[#2196F3]/40 transition-all disabled:opacity-50">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {refreshing ? 'Atualizando...' : 'Refresh Dataset'}
          </button>
        </div>

        {embedData && (
          <div className="bg-[#0F1117] border border-emerald-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-3">
              <CheckCircle2 className="w-4 h-4" /> Token gerado com sucesso
            </div>
            {[
              { label: 'Embed Token', value: embedData.embed_token?.slice(0, 32) + '…' },
              { label: 'Expira em',   value: embedData.expiration ? new Date(embedData.expiration).toLocaleString('pt-BR') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#8892A4]">{label}</span>
                <span className="text-white font-mono">{value}</span>
              </div>
            ))}
            <a href={embedData.embed_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[#2196F3] text-xs hover:underline mt-2">
              <ExternalLink className="w-3 h-3" /> Abrir relatório
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ LEONARDO AI PANEL ═══════════════════ */
function LeonardoPanel() {
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [err, setErr] = useState('');
  const [genId, setGenId] = useState('');

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setErr(''); setImages([]);
    try {
      const result = await apiCall('/api/leonardo/generate/wait', 'POST', {
        prompt,
        negative_prompt: negPrompt || undefined,
        width: Number(width),
        height: Number(height),
        num_images: 1,
      });
      setImages(result.images || []);
      setGenId(result.generation_id || '');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const SIZES = ['512x512', '768x768', '1024x1024', '1024x768', '768x1024'];

  return (
    <div className="bg-[#161B27] border border-[#1E2535] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Leonardo AI</h3>
          <p className="text-[#8892A4] text-xs">Geração de imagens para documentação e treinamento</p>
        </div>
        <Badge variant="purple" className="ml-auto">Phoenix</Badge>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Prompt</label>
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            rows={3} placeholder="Descreva a imagem que deseja gerar..."
            className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none"
          />
        </div>
        <div>
          <label className="block text-[#8892A4] text-xs font-medium mb-1.5 uppercase tracking-wider">Negative Prompt (opcional)</label>
          <input value={negPrompt} onChange={e => setNegPrompt(e.target.value)}
            placeholder="blurry, low quality, distorted..."
            className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#8892A4] focus:outline-none focus:border-purple-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-[#8892A4] text-xs font-medium mb-2 uppercase tracking-wider">Tamanho</label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map(s => {
              const [w, h] = s.split('x').map(Number);
              return (
                <button key={s} onClick={() => { setWidth(w); setHeight(h); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    width === w && height === h
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#0F1117] border border-[#1E2535] text-[#8892A4] hover:text-white hover:border-purple-500/40'
                  }`}>{s}</button>
              );
            })}
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{err}
          </div>
        )}

        <button onClick={generate} disabled={loading || !prompt.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 w-full justify-center">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando imagem (30–60s)...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Gerar Imagem</>
          )}
        </button>

        {images.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {images.map(img => (
              <div key={img.id} className="relative rounded-xl overflow-hidden border border-[#1E2535]">
                <img src={img.url} alt="Generated" className="w-full h-auto" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-mono">{img.id?.slice(0, 12)}…</span>
                    <a href={img.url} download target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[#2196F3] text-xs hover:underline">
                      <ExternalLink className="w-3 h-3" /> Baixar
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ PAGE ═══════════════════ */
export default function Integrations() {
  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Power BI Embedded e Leonardo AI conectados ao Copilot Protheus"
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PowerBIPanel />
        <LeonardoPanel />
      </div>
    </div>
  );
}

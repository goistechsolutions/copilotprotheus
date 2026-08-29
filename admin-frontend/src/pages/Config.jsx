import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BrainCircuit, CheckCircle2, EyeOff, Save, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const SECRET_MARKERS = ['PASSWORD', 'SECRET', 'TOKEN', 'API_KEY', 'ACCESS_KEY'];
const SECRET_VALUES = new Set(['configured', 'not_configured']);
const AI_KEYS = ['LLM_BACKEND', 'GEMINI_MODEL', 'GEMINI_API_KEY', 'OLLAMA_MODEL', 'OLLAMA_BASE_URL'];

function isSensitiveKey(key) {
  const normalized = String(key || '').toUpperCase();
  return SECRET_MARKERS.some(marker => normalized.includes(marker));
}

function formatLabel(key) {
  return String(key || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, char => char.toUpperCase());
}

function ConfigField({ configKey, value, draft, sensitive, saving, saved, onChange, onSave }) {
  const isConfigured = sensitive && SECRET_VALUES.has(String(value || '').toLowerCase()) && value !== 'not_configured';
  return (
    <div className="rounded-xl border border-[#1E2A3D] bg-[#111827]/70 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <label htmlFor={`config-${configKey}`} className="text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]">{formatLabel(configKey)}</label>
          <p className="mt-0.5 font-mono text-[10px] text-[#64748B]">{configKey}</p>
        </div>
        {sensitive && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${isConfigured ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}>
            <ShieldCheck className="h-3 w-3" />
            {isConfigured ? 'Configurado' : 'Não configurado'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={`config-${configKey}`}
            type="text"
            value={sensitive ? (isConfigured ? '••••••••••••••••' : 'Não configurado') : draft ?? ''}
            onChange={event => onChange(configKey, event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !sensitive) onSave(configKey); }}
            placeholder={sensitive ? 'Gerenciado no ambiente de implantação' : 'Não informado'}
            autoComplete="off"
            readOnly={sensitive}
            disabled={saving}
            className={`w-full rounded-lg border border-[#263550] px-3 py-2.5 text-sm outline-none transition placeholder:text-[#64748B] focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/15 disabled:opacity-60 ${sensitive ? 'bg-[#0B1220]/70 font-mono tracking-widest text-[#64748B]' : 'bg-[#0B1220] text-white'}`}
          />
          {sensitive && <EyeOff className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />}
        </div>
        {!sensitive && <button
          type="button"
          onClick={() => onSave(configKey)}
          disabled={saving}
          title="Salvar configuração"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2B3850] bg-[#1E293B] px-3 text-xs font-medium text-[#CBD5E1] transition hover:border-[#60A5FA]/60 hover:bg-[#24344F] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saved ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{saved ? 'Salvo' : 'Salvar'}</span>
        </button>}
      </div>
      {sensitive && <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-[#64748B]"><ShieldCheck className="h-3 w-3 shrink-0" />Credencial protegida. A alteração deve ser feita no ambiente seguro de implantação; o conteúdo nunca é retornado pela API.</p>}
    </div>
  );
}

export default function Config() {
  const [configs, setConfigs] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/admin/config');
      const next = response.data?.configs && typeof response.data.configs === 'object' ? response.data.configs : {};
      setConfigs(next);
      setDrafts(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, isSensitiveKey(key) ? '' : String(value ?? '')])));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateDraft = (key, value) => setDrafts(previous => ({ ...previous, [key]: value }));

  const save = async key => {
    const value = String(drafts[key] ?? '');
    if (isSensitiveKey(key)) {
      setError('Credenciais e segredos não podem ser alterados pelo painel administrativo.');
      return;
    }
    setSavingKey(key);
    setError('');
    try {
      await api.post('/api/admin/config', { key, value });
      setConfigs(previous => ({ ...previous, [key]: isSensitiveKey(key) ? 'configured' : value }));
      setDrafts(previous => ({ ...previous, [key]: '' }));
      setSavedKey(key);
      window.setTimeout(() => setSavedKey(previous => previous === key ? null : previous), 2200);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || 'Não foi possível salvar a configuração.');
    } finally {
      setSavingKey(null);
    }
  };

  const advancedKeys = useMemo(() => Object.keys(configs).filter(key => !AI_KEYS.includes(key)).sort(), [configs]);
  const provider = configs.LLM_BACKEND || drafts.LLM_BACKEND || 'gemini';
  const aiKeys = provider === 'ollama' ? ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'] : ['GEMINI_API_KEY', 'GEMINI_MODEL'];

  if (loading) {
    return <div className="space-y-5"><PageHeader title="Configurações" description="Preferências seguras da plataforma e do motor de IA." /><div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-xl border border-[#1E2A3D] bg-[#161B27]" /><div className="h-32 animate-pulse rounded-xl border border-[#1E2A3D] bg-[#161B27]" /></div></div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Configurações" description="Gerencie preferências da plataforma sem expor credenciais ou tokens." />

      {error && <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="overflow-hidden rounded-2xl border border-[#2B3850] bg-gradient-to-br from-[#172554] via-[#161B27] to-[#111827]">
        <div className="flex items-start gap-4 border-b border-[#2B3850] p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/20 text-[#93C5FD]"><BrainCircuit className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-semibold text-white">Motor de Inteligência Artificial</h2><p className="mt-1 text-sm text-[#94A3B8]">Escolha o provedor e mantenha os valores sensíveis sob controle do servidor.</p></div>
        </div>
        <div className="grid gap-4 p-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#2B3850] bg-[#0F172A]/70 p-4 lg:col-span-2">
            <label htmlFor="config-LLM_BACKEND" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#CBD5E1]">Provedor ativo</label>
            <select id="config-LLM_BACKEND" value={drafts.LLM_BACKEND || provider} onChange={event => updateDraft('LLM_BACKEND', event.target.value)} className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/15">
              <option value="gemini">Google Gemini (nuvem)</option>
              <option value="ollama">Ollama (local)</option>
            </select>
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => save('LLM_BACKEND')} disabled={savingKey === 'LLM_BACKEND'} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Salvar provedor</button></div>
          </div>
          {aiKeys.map(key => <ConfigField key={key} configKey={key} value={configs[key]} draft={drafts[key]} sensitive={isSensitiveKey(key)} saving={savingKey === key} saved={savedKey === key} onChange={updateDraft} onSave={save} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-[#1E2A3D] bg-[#161B27]">
        <div className="border-b border-[#1E2A3D] px-6 py-4"><h2 className="text-base font-semibold text-white">Configurações avançadas</h2><p className="mt-1 text-xs text-[#94A3B8]">Apenas valores não sensíveis são exibidos. Segredos aparecem como estado, nunca como conteúdo.</p></div>
        <div className="grid gap-4 p-6 md:grid-cols-2">{advancedKeys.map(key => <ConfigField key={key} configKey={key} value={configs[key]} draft={drafts[key]} sensitive={isSensitiveKey(key)} saving={savingKey === key} saved={savedKey === key} onChange={updateDraft} onSave={save} />)}</div>
        {advancedKeys.length === 0 && <div className="px-6 pb-6 text-sm text-[#94A3B8]">Nenhuma configuração avançada foi disponibilizada pelo backend.</div>}
      </section>
    </div>
  );
}

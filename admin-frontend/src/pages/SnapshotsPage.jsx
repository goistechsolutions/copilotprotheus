import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Database, FileSearch, Layers3, RefreshCw, Search, Table2 } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

function normalizeList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function SummaryCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-[#1565C0]/15 text-[#60A5FA]',
    green: 'bg-emerald-500/15 text-emerald-400',
    purple: 'bg-purple-500/15 text-purple-400',
  };
  return <div className="rounded-xl border border-[#1E2A3D] bg-[#161B27] p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone] || tones.blue}`}><Icon className="h-4 w-4" /></div><div className="text-2xl font-bold text-white">{value}</div><div className="mt-1 text-xs text-[#94A3B8]">{label}</div></div>;
}

export default function SnapshotsPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTenants = async () => {
    setLoadingTenants(true);
    setError('');
    try {
      const response = await api.get('/api/tenants');
      const list = normalizeList(response.data, ['tenants', 'items']);
      setTenants(list);
      setSelectedTenant(current => current || (list.length === 1 ? String(list[0].tenant_code || list[0].id || '') : ''));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar os tenants autorizados.');
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadSnapshots = async (tenant = selectedTenant) => {
    if (!tenant) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/admin/snapshots?tenant_id=${encodeURIComponent(tenant)}`);
      setSnapshots(normalizeList(response.data, ['snapshots', 'items']));
    } catch (requestError) {
      setSnapshots([]);
      setError(requestError.response?.data?.detail || 'Não foi possível carregar o resumo do catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);
  useEffect(() => { if (selectedTenant) loadSnapshots(selectedTenant); }, [selectedTenant]);

  const filteredSnapshots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return snapshots;
    return snapshots.filter(snapshot => `${snapshot.moduleSigla || ''} ${snapshot.moduleId || ''}`.toLowerCase().includes(query));
  }, [search, snapshots]);

  const totalTables = snapshots.reduce((total, snapshot) => total + (Number(snapshot.total_tabelas) || 0), 0);
  const latestUpdate = snapshots.reduce((latest, snapshot) => {
    const value = snapshot.ultima_atualizacao ? new Date(snapshot.ultima_atualizacao).getTime() : 0;
    return value > latest ? value : latest;
  }, 0);
  const selectedTenantRecord = tenants.find(tenant => String(tenant.tenant_code || tenant.tenant_id || tenant.id) === String(selectedTenant));
  const selectedTenantName = selectedTenantRecord?.tenant_name || selectedTenantRecord?.name || '';
  const tenantLabel = selectedTenantName ? `${selectedTenant} — ${selectedTenantName}` : selectedTenant;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Snapshots do dicionário (Agregado por Tenant)"
        description="Resumo do catálogo SX2/SX3/SXG/SIX sincronizado e agregado por módulo em todas as empresas do tenant."
        actions={<button type="button" onClick={() => loadSnapshots()} disabled={!selectedTenant || loading} className="inline-flex items-center gap-2 rounded-lg border border-[#2B3850] bg-[#161B27] px-3.5 py-2 text-sm font-medium text-[#CBD5E1] transition hover:border-[#60A5FA]/60 hover:bg-[#1E293B] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>}
      />

      {error && <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="rounded-2xl border border-[#2B3850] bg-gradient-to-br from-[#172554] via-[#161B27] to-[#111827] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-[#93C5FD]"><Layers3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Escopo do catálogo</span></div><h2 className="text-base font-semibold text-white">Selecione o tenant para consultar seus metadados</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#94A3B8]">Os números abaixo são lidos do schema autorizado do tenant. Quando não houver snapshot, o painel informa a ausência sem criar dados de preenchimento.</p></div>
                      <div className="w-full lg:max-w-xs"><label htmlFor="snapshot-tenant" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Tenant</label><select id="snapshot-tenant" value={selectedTenant} onChange={event => setSelectedTenant(event.target.value)} disabled={loadingTenants} className="w-full rounded-lg border border-[#334155] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA] disabled:opacity-60"><option value="">{loadingTenants ? 'Carregando tenants…' : 'Selecione um tenant'}</option>{tenants.map(tenant => { const value = String(tenant.tenant_code || tenant.tenant_id || tenant.id || ''); const name = tenant.tenant_name || tenant.name || ''; return <option key={value} value={value}>{name ? `${value} — ${name}` : value}</option>; })}</select></div>

        </div>
      </section>

      {selectedTenant && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard icon={Layers3} label="Módulos com catálogo" value={snapshots.length} tone="blue" /><SummaryCard icon={Table2} label="Tabelas catalogadas" value={totalTables.toLocaleString('pt-BR')} tone="green" /><SummaryCard icon={CalendarClock} label="Última atualização" value={latestUpdate ? formatDate(latestUpdate) : '—'} tone="purple" /></div>}

      {!selectedTenant ? <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#2B3850] bg-[#111827]/60 px-6 text-center"><Database className="mb-3 h-10 w-10 text-[#334155]" /><h2 className="text-sm font-semibold text-white">Nenhum tenant selecionado</h2><p className="mt-1 max-w-md text-xs leading-5 text-[#94A3B8]">Escolha um tenant acima para consultar o resumo real da sincronização do dicionário.</p></div> : <section className="overflow-hidden rounded-2xl border border-[#1E2A3D] bg-[#161B27]">
        <div className="flex flex-col gap-3 border-b border-[#1E2A3D] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-[#60A5FA]" /><div><h2 className="text-sm font-semibold text-white">Resumo por módulo</h2><p className="text-[10px] text-[#64748B]">Tenant: {tenantLabel || selectedTenant} · {filteredSnapshots.length} de {snapshots.length} módulos</p></div></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar módulo…" className="w-full rounded-lg border border-[#263550] bg-[#0B1220] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA]" /></div></div>
        {loading ? <div className="flex min-h-56 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-[#60A5FA]" /></div> : filteredSnapshots.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><CheckCircle2 className="mb-3 h-9 w-9 text-[#334155]" /><h2 className="text-sm font-semibold text-white">{search ? 'Nenhum módulo corresponde à busca' : 'Nenhum snapshot encontrado'}</h2><p className="mt-1 max-w-md text-xs leading-5 text-[#94A3B8]">{search ? 'Altere o termo de busca para consultar o resumo disponível.' : 'Execute uma sincronização do dicionário real para este tenant e ambiente antes de consultar o catálogo.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="border-b border-[#1E2A3D] bg-[#111827]/70"><tr>{['Módulo', 'Código', 'Tabelas catalogadas', 'Última atualização'].map(header => <th key={header} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#1E2A3D]">{filteredSnapshots.map((snapshot, index) => <tr key={`${snapshot.moduleId || 'module'}-${snapshot.moduleSigla || index}`} className="transition hover:bg-[#1E2535]/40"><td className="px-5 py-3 font-medium text-white">{snapshot.moduleSigla || 'Módulo não identificado'}</td><td className="px-5 py-3 font-mono text-xs text-[#CBD5E1]">{snapshot.moduleId ?? '—'}</td><td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300"><CheckCircle2 className="h-3 w-3" />{Number(snapshot.total_tabelas || 0).toLocaleString('pt-BR')}</span></td><td className="px-5 py-3 text-xs text-[#94A3B8]">{formatDate(snapshot.ultima_atualizacao)}</td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  );
}


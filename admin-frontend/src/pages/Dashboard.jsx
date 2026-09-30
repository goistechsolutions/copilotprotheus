import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Circle,
  Clock,
  Database,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

function KpiCard({ title, value, sub, icon: Icon, color = 'blue', trend, to }) {
  const colors = {
    blue: { bg: 'bg-[#1565C0]/15', text: 'text-[#60A5FA]', ring: 'ring-[#1565C0]/30' },
    green: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', ring: 'ring-purple-500/30' },
    yellow: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  };
  const palette = colors[color] || colors.blue;
  const Wrapper = to ? Link : 'div';

  return (
    <Wrapper
      to={to}
      className={`flex flex-col gap-3 rounded-xl border border-[#1E2535] bg-[#161B27] p-5 ${
        to ? 'group cursor-pointer transition-all hover:border-[#2196F3]/40 hover:bg-[#1E2535]/60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${palette.bg} ring-1 ${palette.ring}`}>
          <Icon className={`h-[18px] w-[18px] ${palette.text}`} />
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-white">{value ?? <span className="text-[#8892A4]">—</span>}</div>
        <div className="mt-0.5 text-xs font-medium text-[#CBD5E1]">{title}</div>
        {sub && <div className="mt-0.5 text-[10px] text-[#8892A4]">{sub}</div>}
      </div>
    </Wrapper>
  );
}

function ActivityBar({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[#94A3B8]">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#1E2535]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#1565C0] to-[#2196F3] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusRow({ name, status }) {
  const config = {
    online: { dot: 'bg-emerald-400 shadow-emerald-400/60', label: 'Online', text: 'text-emerald-400' },
    healthy: { dot: 'bg-emerald-400 shadow-emerald-400/60', label: 'Saudável', text: 'text-emerald-400' },
    configured: { dot: 'bg-sky-400', label: 'Configurado', text: 'text-sky-300' },
    degraded: { dot: 'bg-amber-400 shadow-amber-400/60', label: 'Degradado', text: 'text-amber-400' },
    offline: { dot: 'bg-red-400 shadow-red-400/60', label: 'Offline', text: 'text-red-400' },
    unknown: { dot: 'bg-[#8892A4]', label: 'Não verificado', text: 'text-[#94A3B8]' },
  }[status] || { dot: 'bg-[#8892A4]', label: 'Não verificado', text: 'text-[#94A3B8]' };

  return (
    <div className="flex items-center justify-between rounded-lg bg-[#0F1117] px-4 py-3">
      <span className="text-sm text-[#CBD5E1]">{name}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${config.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full shadow-sm ${config.dot}`} />
        {config.label}
      </span>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, desc, color = 'blue' }) {
  const colors = {
    blue: 'bg-[#1565C0]/15 text-[#60A5FA]',
    green: 'bg-emerald-500/15 text-emerald-400',
    purple: 'bg-purple-500/15 text-purple-400',
  };
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-transparent bg-[#0F1117] px-4 py-3 transition-all hover:border-[#2196F3]/30 hover:bg-[#1E2535]">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors[color] || colors.blue}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="truncate text-xs text-[#94A3B8]">{desc}</div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-[#8892A4] transition-colors group-hover:text-[#60A5FA]" />
    </Link>
  );
}

function DashboardNotice({ children, tone = 'warning' }) {
  const styles = tone === 'error'
    ? 'border-red-400/20 bg-red-400/10 text-red-200'
    : 'border-amber-400/20 bg-amber-400/10 text-amber-200';
  return <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${styles}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

const SERVICE_LABELS = {
  'FastAPI Backend': 'FastAPI Backend',
  PostgreSQL: 'PostgreSQL',
  pgvector: 'pgvector / RAG',
  'OpenAI API': 'OpenAI API',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [infra, setInfra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [infraError, setInfraError] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.get('/api/admin/dashboard/stats'),
      api.get('/health'),
      api.get('/api/infra/status'),
    ]).then(([statsResult, healthResult, infraResult]) => {
      if (!mounted) return;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value.data);
      else setStatsError(true);
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value.data);
      if (infraResult.status === 'fulfilled') setInfra(infraResult.value.data);
      else setInfraError(true);
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const kpis = [
    { title: 'Tenants ativos', value: stats?.tenants, icon: Building2, color: 'blue', trend: stats?.tenants_trend, to: '/tenants', sub: 'cadastros ativos' },
    { title: 'Usuários', value: stats?.users, icon: Users, color: 'purple', trend: stats?.users_trend, to: '/users', sub: 'usuários do agente' },
    { title: 'Conversas hoje', value: stats?.conversations_today, icon: MessageSquare, color: 'green', trend: stats?.conv_trend, to: '/logs', sub: 'sessões iniciadas' },
    { title: 'Documentos RAG', value: stats?.rag_documents, icon: BookOpen, color: 'yellow', trend: undefined, to: '/knowledge', sub: 'documentos indexados' },
    { title: 'Tempo de resposta', value: stats?.avg_response_ms != null ? `${stats.avg_response_ms} ms` : null, icon: Zap, color: 'blue', sub: 'média disponível na API' },
    { title: 'Tabelas no catálogo', value: stats?.catalog_tables, icon: Database, color: 'green', trend: undefined, to: '/tables', sub: 'quando informado pela API' },
  ];

  const activityModules = Array.isArray(stats?.activity_by_module) ? stats.activity_by_module : [];
  const maxActivity = Math.max(...activityModules.map(module => Number(module.value) || 0), 1);
  const recentActions = Array.isArray(stats?.recent_actions) ? stats.recent_actions : [];
  const services = useMemo(() => {
    const infraServices = infra?.services && typeof infra.services === 'object' ? infra.services : {};
    const getStatus = (key, fallback = 'unknown') => {
      const value = infraServices[key];
      const raw = typeof value === 'string' ? value : value?.status;
      return raw ? String(raw).toLowerCase() : fallback;
    };
    return [
      { name: SERVICE_LABELS['FastAPI Backend'], status: stats ? 'online' : 'unknown' },
      { name: SERVICE_LABELS.PostgreSQL, status: health?.database === 'healthy' ? 'healthy' : health ? 'offline' : getStatus('PostgreSQL') },
      { name: SERVICE_LABELS.pgvector, status: getStatus('pgvector') },
      { name: SERVICE_LABELS['OpenAI API'], status: getStatus('OpenAI API') },
    ];
  }, [health, infra, stats]);

  const verifiedCount = services.filter(service => ['online', 'healthy', 'configured'].includes(service.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Dashboard" description="Visão operacional da plataforma Copilot Protheus" />
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-white">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-xs text-[#94A3B8]">{now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
        </div>
      </div>

      {(statsError || infraError) && (
        <DashboardNotice tone={statsError ? 'error' : 'warning'}>
          <span>{statsError ? 'As métricas do dashboard não puderam ser carregadas.' : 'A matriz completa de saúde não pôde ser verificada.'} Os valores não disponíveis são exibidos como “—” e não são estimados. Consulte <Link className="font-semibold underline" to={statsError ? '/logs' : '/platform'}>{statsError ? 'Logs' : 'Infra & Saúde'}</Link> para investigar.</span>
        </DashboardNotice>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => <div key={index} className="animate-pulse space-y-3 rounded-xl border border-[#1E2535] bg-[#161B27] p-5"><div className="h-9 w-9 rounded-lg bg-[#1E2535]" /><div className="h-7 w-16 rounded bg-[#1E2535]" /><div className="h-3 w-28 rounded bg-[#1E2535]" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{kpis.map((kpi, index) => <KpiCard key={index} {...kpi} />)}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#2196F3]" /><span className="text-sm font-semibold text-white">Consultas por módulo Protheus</span></div>
            <span className="rounded border border-[#1E2535] bg-[#0F1117] px-2 py-1 text-[10px] text-[#94A3B8]">Últimas 24h</span>
          </div>
          {loading ? <div className="space-y-4">{[...Array(4)].map((_, index) => <div key={index} className="space-y-1"><div className="h-3 w-20 animate-pulse rounded bg-[#1E2535]" /><div className="h-1.5 animate-pulse rounded bg-[#1E2535]" /></div>)}</div> : activityModules.length > 0 ? <div className="space-y-4">{activityModules.map((module, index) => <ActivityBar key={`${module.label || module.moduleSigla || index}`} label={module.label || module.moduleSigla || 'Módulo não identificado'} value={Number(module.value) || 0} max={maxActivity} />)}</div> : <div className="flex min-h-40 flex-col items-center justify-center text-center"><Database className="mb-3 h-9 w-9 text-[#334155]" /><p className="text-sm font-medium text-white">Distribuição por módulo indisponível</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#94A3B8]">A API atual não retornou essa série. Nenhum módulo foi inventado para preencher o gráfico.</p></div>}
        </div>

        <div className="flex flex-col rounded-xl border border-[#1E2535] bg-[#161B27] p-5">
          <div className="mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-[#2196F3]" /><span className="text-sm font-semibold text-white">Ações recentes</span></div>
          <div className="max-h-48 flex-1 space-y-3 overflow-y-auto pr-1">
            {recentActions.length === 0 ? <div className="flex h-full flex-col items-center justify-center py-6 text-center"><Circle className="mb-2 h-8 w-8 text-[#334155]" /><p className="text-xs text-[#94A3B8]">Nenhuma ação retornada no período.</p></div> : recentActions.map((action, index) => <div key={index} className="flex items-start gap-2.5"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2196F3]" /><div><p className="text-xs text-white">{action.description || action.action || 'Ação registrada'}</p><p className="mt-0.5 text-[10px] text-[#94A3B8]">{action.time || action.created_at || '—'}</p></div></div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#2196F3]" /><span className="text-sm font-semibold text-white">Saúde verificada</span></div><span className="flex items-center gap-1 text-[10px] text-[#94A3B8]"><ShieldCheck className="h-3 w-3" />{verifiedCount}/{services.length} estados conhecidos</span></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{services.map(service => <StatusRow key={service.name} {...service} />)}</div>
          <p className="mt-3 text-[10px] leading-4 text-[#64748B]">“Não verificado” significa que a API não forneceu uma medição nesta consulta; não é tratado como online.</p>
        </div>

        <div className="rounded-xl border border-[#1E2535] bg-[#161B27] p-5">
          <div className="mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-[#2196F3]" /><span className="text-sm font-semibold text-white">Ações rápidas</span></div>
          <div className="space-y-2">
            <QuickAction to="/dictionary" icon={Database} color="blue" label="Sincronizar dicionário" desc="Extrair metadados reais do Protheus" />
            <QuickAction to="/tenants" icon={Building2} color="blue" label="Gerenciar tenants" desc="Revisar contratos e ambientes" />
            <QuickAction to="/users" icon={Users} color="purple" label="Gerenciar usuários" desc="Revisar perfis e acessos" />
            <QuickAction to="/knowledge" icon={BookOpen} color="green" label="Base de conhecimento" desc="Consultar documentos RAG indexados" />
          </div>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, MessageSquare, BookOpen,
  Activity, Zap, Database, ShieldCheck,
  ArrowUpRight, ArrowDownRight, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, Circle
} from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color = 'blue', trend, to }) {
  const colors = {
    blue:   { bg: 'bg-[#1565C0]/15', text: 'text-[#60A5FA]', ring: 'ring-[#1565C0]/30' },
    green:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    purple: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  ring: 'ring-purple-500/30' },
    yellow: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30' },
    red:    { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30' },
  };
  const c = colors[color] || colors.blue;
  const Wrapper = to ? Link : 'div';
  return (
    <Wrapper to={to}
      className={`bg-[#161B27] border border-[#1E2535] rounded-xl p-5 flex flex-col gap-3 ${
        to ? 'hover:border-[#2196F3]/40 hover:bg-[#1E2535]/60 transition-all cursor-pointer group' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${c.text}`} size={18} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${
            trend >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-white tracking-tight">{value ?? <span className="text-[#8892A4]">—</span>}</div>
        <div className="text-xs font-medium text-[#8892A4] mt-0.5">{title}</div>
        {sub && <div className="text-[10px] text-[#8892A4]/60 mt-0.5">{sub}</div>}
      </div>
    </Wrapper>
  );
}

// ── Activity Bar ─────────────────────────────────────────────────────────────
function ActivityBar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8892A4]">{label}</span>
        <span className="text-white font-semibold">{value}</span>
      </div>
      <div className="h-1.5 bg-[#1E2535] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#1565C0] to-[#2196F3] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Status Dot ───────────────────────────────────────────────────────────────
function StatusRow({ name, status }) {
  const cfg = {
    online:  { dot: 'bg-emerald-400 shadow-emerald-400/60', label: 'Online',     txt: 'text-emerald-400' },
    degraded:{ dot: 'bg-amber-400  shadow-amber-400/60',   label: 'Degradado',  txt: 'text-amber-400' },
    offline: { dot: 'bg-red-400   shadow-red-400/60',      label: 'Offline',    txt: 'text-red-400' },
    unknown: { dot: 'bg-[#8892A4] shadow-none',            label: 'Verificando',txt: 'text-[#8892A4]' },
  }[status] || { dot: 'bg-[#8892A4] shadow-none', label: status, txt: 'text-[#8892A4]' };
  return (
    <div className="flex items-center justify-between bg-[#0F1117] rounded-lg px-4 py-3">
      <span className="text-[#CBD5E1] text-sm">{name}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.txt}`}>
        <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${cfg.dot}`} />
        {cfg.label}
      </span>
    </div>
  );
}

// ── Quick Action ─────────────────────────────────────────────────────────────
function QuickAction({ to, icon: Icon, label, desc, color = 'blue' }) {
  const c = {
    blue:   'text-[#60A5FA] bg-[#1565C0]/15',
    green:  'text-emerald-400 bg-emerald-500/15',
    purple: 'text-purple-400 bg-purple-500/15',
  }[color] || 'text-[#60A5FA] bg-[#1565C0]/15';
  return (
    <Link to={to}
      className="flex items-center gap-3 bg-[#0F1117] hover:bg-[#1E2535] border border-transparent hover:border-[#2196F3]/30 rounded-xl px-4 py-3 transition-all group"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">{label}</div>
        <div className="text-[#8892A4] text-xs truncate">{desc}</div>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-[#8892A4] group-hover:text-[#2196F3] transition-colors" />
    </Link>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow]       = useState(new Date());

  useEffect(() => {
    api.get('/api/admin/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const kpis = [
    { title: 'Tenants Ativos',    value: stats?.tenants,            icon: Building2,    color: 'blue',   trend: stats?.tenants_trend,   to: '/tenants',   sub: 'empresas cadastradas' },
    { title: 'Usuários',          value: stats?.users,              icon: Users,        color: 'purple', trend: stats?.users_trend,     to: '/users',     sub: 'usuários do agente' },
    { title: 'Conversas Hoje',    value: stats?.conversations_today,icon: MessageSquare,color: 'green',  trend: stats?.conv_trend,      to: '/logs',      sub: 'sessões iniciadas' },
    { title: 'Docs RAG',          value: stats?.rag_documents,      icon: BookOpen,     color: 'yellow', trend: undefined,              to: '/knowledge', sub: 'documentos indexados' },
    { title: 'Tempo de Resposta', value: stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : null, icon: Zap, color: 'blue', sub: 'média últimas 24h' },
    { title: 'Tabelas no Catálogo', value: stats?.catalog_tables,   icon: Database,     color: 'green',  trend: undefined,              to: '/tables',    sub: 'tabelas sincronizadas' },
  ];

  const activityModules = stats?.activity_by_module || [
    { label: 'SIGAFAT', value: 0 },
    { label: 'SIGAFIN', value: 0 },
    { label: 'SIGAEST', value: 0 },
    { label: 'SIGACOM', value: 0 },
    { label: 'SIGACRM', value: 0 },
  ];
  const maxActivity = Math.max(...activityModules.map(m => m.value), 1);

  const recentActions = stats?.recent_actions || [];

  const services = [
    { name: 'FastAPI Backend',   status: stats ? 'online'  : 'unknown' },
    { name: 'PostgreSQL',        status: stats ? 'online'  : 'unknown' },
    { name: 'pgvector / RAG',    status: stats ? 'online'  : 'unknown' },
    { name: 'OpenAI API',        status: stats?.openai_ok === false ? 'degraded' : stats ? 'online' : 'unknown' },
    { name: 'Worker Sync',       status: stats?.worker_ok  === false ? 'offline'  : stats ? 'online' : 'unknown' },
    { name: 'Cloudflare Proxy',  status: 'online' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Dashboard"
          description="Visão geral da plataforma Copilot Protheus"
        />
        <div className="text-right shrink-0">
          <div className="text-white text-sm font-semibold">
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[#8892A4] text-xs">
            {now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 animate-pulse space-y-3">
              <div className="w-9 h-9 bg-[#1E2535] rounded-lg" />
              <div className="h-7 bg-[#1E2535] rounded w-16" />
              <div className="h-3 bg-[#1E2535] rounded w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
        </div>
      )}

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Actividade por módulo */}
        <div className="lg:col-span-2 bg-[#161B27] border border-[#1E2535] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#2196F3]" />
              <span className="text-white text-sm font-semibold">Consultas por Módulo Protheus</span>
            </div>
            <span className="text-[10px] text-[#8892A4] bg-[#0F1117] border border-[#1E2535] px-2 py-1 rounded">Últimas 24h</span>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 bg-[#1E2535] rounded w-20 animate-pulse" />
                  <div className="h-1.5 bg-[#1E2535] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {activityModules.map((m, i) => (
                <ActivityBar key={i} label={m.label} value={m.value} max={maxActivity} />
              ))}
              {activityModules.every(m => m.value === 0) && (
                <p className="text-center text-[#8892A4]/60 text-sm py-4">Nenhuma consulta registrada nas últimas 24h.</p>
              )}
            </div>
          )}
        </div>

        {/* Ações Recentes */}
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#2196F3]" />
            <span className="text-white text-sm font-semibold">Ações Recentes</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-48 pr-1">
            {recentActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-6">
                <Circle className="w-8 h-8 text-[#1E2535] mb-2" />
                <p className="text-[#8892A4]/60 text-xs text-center">Nenhuma ação registrada ainda.</p>
              </div>
            ) : recentActions.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2196F3] mt-1.5 shrink-0" />
                <div>
                  <p className="text-white text-xs">{a.description}</p>
                  <p className="text-[#8892A4] text-[10px] mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Status dos Serviços */}
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2196F3]" />
              <span className="text-white text-sm font-semibold">Status dos Serviços</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {loading ? '...' : `${services.filter(s => s.status === 'online').length}/${services.length} Online`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map(svc => <StatusRow key={svc.name} {...svc} />)}
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#2196F3]" />
            <span className="text-white text-sm font-semibold">Ações Rápidas</span>
          </div>
          <div className="space-y-2">
            <QuickAction to="/dictionary" icon={Database}    color="blue"   label="Sincronizar Dicionário" desc="Extrair metadados do Protheus" />
            <QuickAction to="/tenants"   icon={Building2}   color="blue"   label="Gerenciar Tenants"     desc="Criar ou editar clientes" />
            <QuickAction to="/users"     icon={Users}       color="purple" label="Gerenciar Usuários"    desc="Permissões e acessos" />
            <QuickAction to="/knowledge" icon={BookOpen}    color="green"  label="Base de Conhecimento" desc="Documentos RAG indexados" />
          </div>
        </div>

      </div>
    </div>
  );
}

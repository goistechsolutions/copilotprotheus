import { useState, useEffect } from 'react';
import { Building2, Users, MessageSquare, BookOpen, Activity, Zap } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import PageHeader from '../components/ui/PageHeader';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard/stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cards = [
    { title: 'Tenants Ativos', value: stats?.tenants ?? '—', icon: Building2, color: 'blue', subtitle: 'empresas cadastradas' },
    { title: 'Usuários', value: stats?.users ?? '—', icon: Users, color: 'purple', subtitle: 'usuários do agente' },
    { title: 'Conversas Hoje', value: stats?.conversations_today ?? '—', icon: MessageSquare, color: 'green', subtitle: 'sessões iniciadas' },
    { title: 'Docs na Base RAG', value: stats?.rag_documents ?? '—', icon: BookOpen, color: 'yellow', subtitle: 'documentos indexados' },
    { title: 'Tempo de Resposta', value: stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : '—', icon: Zap, color: 'blue', subtitle: 'média últimas 24h' },
    { title: 'Uptime', value: stats?.uptime ?? '—', icon: Activity, color: 'green', subtitle: 'serviços operacionais' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral da plataforma Copilot Protheus"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-[#1E2535] rounded w-24 mb-3" />
              <div className="h-8 bg-[#1E2535] rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <StatCard key={i} {...card} />
          ))}
        </div>
      )}

      <div className="mt-6 bg-[#161B27] border border-[#1E2535] rounded-xl p-5">
        <h2 className="text-white text-sm font-semibold mb-4">Status dos Serviços</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'FastAPI Backend', status: 'online' },
            { name: 'PostgreSQL', status: 'online' },
            { name: 'pgvector RAG', status: stats ? 'online' : 'unknown' },
            { name: 'OpenAI API', status: stats ? 'online' : 'unknown' },
          ].map(svc => (
            <div key={svc.name} className="flex items-center gap-2 bg-[#0F1117] rounded-lg px-3 py-2.5">
              <div className={`w-2 h-2 rounded-full ${
                svc.status === 'online' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' :
                svc.status === 'unknown' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className="text-[#8892A4] text-xs">{svc.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

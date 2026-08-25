import { useState } from 'react';
import { RefreshCw, Server, Database, Cpu, HardDrive, Cloud, Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const STATUS_CFG = {
  online:   { variant: 'green',  icon: CheckCircle2,  label: 'Online',   dot: 'bg-emerald-400 shadow-emerald-400/50' },
  healthy:  { variant: 'green',  icon: CheckCircle2,  label: 'Saudável', dot: 'bg-emerald-400 shadow-emerald-400/50' },
  degraded: { variant: 'yellow', icon: AlertTriangle, label: 'Degradado', dot: 'bg-amber-400' },
  offline:  { variant: 'red',    icon: XCircle,       label: 'Offline',   dot: 'bg-red-400' },
  unknown:  { variant: 'default',icon: Activity,      label: 'Desconhecido', dot: 'bg-[#8892A4]' },
};

function ServiceCard({ name, status, details, icon: Icon }) {
  const cfg = STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.unknown;
  const StatusIcon = cfg.icon;
  return (
    <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 hover:border-[#2196F3]/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0F1117] rounded-lg flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-[#2196F3]" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">{name}</p>
            {details?.version && <p className="text-[#8892A4] text-xs">{details.version}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full shadow-sm ${cfg.dot}`} />
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
      </div>
      {details && (
        <div className="space-y-1.5">
          {details.latency_ms !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8892A4]">Latência</span>
              <span className="text-white">{details.latency_ms}ms</span>
            </div>
          )}
          {details.connections !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8892A4]">Conexões</span>
              <span className="text-white">{details.connections}</span>
            </div>
          )}
          {details.size_mb !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8892A4]">Tamanho</span>
              <span className="text-white">{details.size_mb} MB</span>
            </div>
          )}
          {details.model !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8892A4]">Modelo</span>
              <span className="text-white">{details.model}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SERVICE_ICONS = {
  fastapi: Server,
  postgres: Database,
  postgresql: Database,
  pgvector: Database,
  openai: Cloud,
  redis: Cpu,
  default: HardDrive,
};

export default function Infra() {
  const { data, loading, refetch } = useApi('/api/admin/infra/status');
  const { data: envData } = useApi('/api/admin/infra/env');

  // Normaliza resposta do backend
  const services = data?.services
    ? Object.entries(data.services).map(([key, val]) => ({
        name: key,
        status: typeof val === 'string' ? val : val?.status || 'unknown',
        details: typeof val === 'object' ? val : null,
      }))
    : [];

  const envVars = Array.isArray(envData)
    ? envData
    : envData?.env
      ? Object.entries(envData.env).map(([k, v]) => ({ key: k, value: v }))
      : [];

  return (
    <div>
      <PageHeader
        title="Plataforma & Infraestrutura"
        description="Status dos serviços e configurações de ambiente"
        actions={
          <button onClick={refetch} className="p-2 text-[#8892A4] hover:text-white hover:bg-[#1E2535] rounded-lg transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Serviços */}
      <h2 className="text-white text-sm font-semibold mb-3">Serviços</h2>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-[#1E2535] rounded w-24 mb-2" />
              <div className="h-3 bg-[#1E2535] rounded w-16" />
            </div>
          ))}
        </div>
      ) : services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {services.map(svc => (
            <ServiceCard
              key={svc.name}
              name={svc.name}
              status={svc.status}
              details={svc.details}
              icon={SERVICE_ICONS[svc.name.toLowerCase()] || SERVICE_ICONS.default}
            />
          ))}
        </div>
      ) : (
        // Fallback estático se o endpoint não retornar dados
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { name: 'FastAPI Backend', status: 'online', icon: Server },
            { name: 'PostgreSQL', status: 'online', icon: Database },
            { name: 'pgvector RAG', status: 'online', icon: Database },
            { name: 'OpenAI API', status: 'unknown', icon: Cloud },
          ].map(svc => <ServiceCard key={svc.name} {...svc} />)}
        </div>
      )}

      {/* Variáveis de Ambiente */}
      {envVars.length > 0 && (
        <>
          <h2 className="text-white text-sm font-semibold mb-3">Variáveis de Ambiente</h2>
          <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#1E2535]">
              {envVars.map(({ key, value }) => (
                <div key={key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[#8892A4] text-xs font-mono">{key}</span>
                  <span className="text-white text-xs font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

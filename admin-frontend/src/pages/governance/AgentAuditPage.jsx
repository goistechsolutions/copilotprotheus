export default function AgentAuditPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Auditoria do Agente</h1>
        <p className="text-slate-400">Análise de interações e desempenho do Copilot.</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <AuditCard title="Consultas" value="12.441" />
        <AuditCard title="Erros" value="14" />
        <AuditCard title="Domínios" value="6" />
        <AuditCard title="Intents" value="42" />
      </div>
      
      <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-8 text-center mt-8">
         <p className="text-slate-400">Integração com agent_query_audit pendente...</p>
      </div>
    </div>
  );
}

function AuditCard({ title, value }) {
  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
      <p className="text-slate-400 mb-1">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

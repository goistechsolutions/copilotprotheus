import { ExternalLink } from 'lucide-react';

export default function Adminer() {
  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Banco de Dados</h2>
          <p className="text-slate-500">Acesso direto ao PostgreSQL via Adminer embutido.</p>
        </div>
        <a 
          href="/adminer/?pgsql=postgres:sap_password_123@db:5432/copilot_protheus" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shrink-0"
        >
          <ExternalLink size={18} /> Abrir em Nova Aba
        </a>
      </div>
      
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <iframe 
          src="/adminer/?pgsql=db&username=postgres&db=copilot_protheus" 
          className="absolute inset-0 w-full h-full border-0"
          title="Adminer"
        />
      </div>
    </div>
  );
}

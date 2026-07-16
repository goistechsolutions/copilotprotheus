import { ExternalLink } from 'lucide-react';

export default function Adminer() {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Banco de Dados</h2>
          <p className="text-slate-500">Acesso direto ao PostgreSQL via Adminer embutido.</p>
        </div>
        <a 
          href="/adminer/?pgsql=db&username=postgres&db=copilot_protheus" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <ExternalLink size={18} /> Abrir em Nova Aba
        </a>
      </div>
      
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <iframe 
          src="/adminer/?pgsql=db&username=postgres&db=copilot_protheus" 
          className="absolute inset-0 w-full h-full border-0"
          title="Adminer"
        />
      </div>
    </div>
  );
}

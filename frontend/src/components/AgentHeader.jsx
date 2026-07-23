import React from 'react';
import { Activity, Building2, UserCircle2, Server } from 'lucide-react';

export default function AgentHeader({ context, status = 'Conectado ao Protheus' }) {
  const isConnected = status.toLowerCase().includes('conectado');

  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isConnected ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
          <Activity size={20} className={isConnected ? "animate-pulse" : ""} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Protheus Copilot</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`relative flex h-2 w-2`}>
              {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            </span>
            <span className="text-xs font-medium text-slate-500">{status}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
          <Server size={14} className="text-slate-400" />
          {context?.tenant || 'Tenant ID'}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 rounded-lg border border-brand-100 text-xs font-medium text-brand-700">
          <Building2 size={14} className="text-brand-500" />
          {context?.company || 'Empresa'} • {context?.branch || 'Filial'}
        </div>
        {context?.user && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
            <UserCircle2 size={14} className="text-slate-400" />
            {context?.user}
          </div>
        )}
      </div>
    </div>
  );
}

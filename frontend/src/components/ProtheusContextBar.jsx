import React from 'react';
import { Building2, UserCircle2, Server } from 'lucide-react';

export default function ProtheusContextBar({ context }) {
  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-inner">
          <span className="font-bold text-sm">P</span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">Copilot</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Online</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-end sm:flex-row sm:items-center gap-1.5 sm:gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-50 border border-brand-100 rounded-md text-[11px] font-medium text-brand-700">
          <Building2 size={12} className="text-brand-500" />
          {context?.company || 'Empresa'} • {context?.branch || 'Filial'}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-medium text-slate-600">
          <UserCircle2 size={12} className="text-slate-400" />
          {context?.user || 'Usuário'}
        </div>
      </div>
    </div>
  );
}

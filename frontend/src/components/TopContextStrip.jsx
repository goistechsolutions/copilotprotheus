import React from 'react';
import { Building2, UserCircle2, ShieldCheck } from 'lucide-react';

export default function TopContextStrip({ context }) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 h-[60px] z-10 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-500" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          Sessão Segura
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600">
          <Building2 size={14} className="text-slate-400" />
          {context?.tenant} • {context?.company} • {context?.branch}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-100 rounded-lg text-xs font-semibold text-brand-700">
          <UserCircle2 size={14} className="text-brand-500" />
          {context?.user}
        </div>
      </div>
    </div>
  );
}

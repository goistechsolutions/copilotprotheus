import React from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

export default function ContextStatus({ status = 'loading', message = 'Montando ambiente...' }) {
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-700 shadow-inner">
        <Loader2 size={14} className="animate-spin text-amber-600" />
        <span className="uppercase tracking-widest">{message}</span>
      </div>
    );
  }

  if (status === 'ok') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-700 shadow-inner animate-in fade-in zoom-in duration-300">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span className="uppercase tracking-widest">Sessão Segura</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-bold text-red-700 shadow-inner">
      <ShieldAlert size={14} className="text-red-600" />
      <span className="uppercase tracking-widest">{message || 'Falha de Contexto'}</span>
    </div>
  );
}

import React from 'react';
import { Loader2, ServerCog } from 'lucide-react';

export default function LoadingOverlay({ visible, text = 'Carregando ambiente...' }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500 animate-in fade-in">
      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl border border-brand-100 flex items-center justify-center mb-6 relative">
        <ServerCog size={36} className="text-brand-500 absolute" />
        <Loader2 size={64} className="text-brand-200 animate-spin absolute" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 tracking-tight">{text}</h3>
      <p className="text-slate-500 mt-2 font-medium max-w-sm text-center">
        Aguardando a injeção segura de dados do Protheus na sessão atual.
      </p>
      
      {/* Indicador de barra de progresso fake */}
      <div className="w-48 h-1.5 bg-slate-200 rounded-full mt-6 overflow-hidden">
        <div className="h-full bg-brand-500 w-1/2 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] origin-left"></div>
      </div>
    </div>
  );
}

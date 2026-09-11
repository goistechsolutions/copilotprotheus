import React from 'react';
import { Star, ExternalLink } from 'lucide-react';

const mockFavorites = [
  { id: 1, title: 'Fechamento Mensal DRE', type: 'Dashboard' },
  { id: 2, title: 'Inadimplência Crítica > 90 dias', type: 'Consulta' },
];

export function FavoritesList() {
  return (
    <div className="flex flex-col gap-3">
      {mockFavorites.map((item) => (
        <div key={item.id} className="group flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 hover:border-amber-300 hover:shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10 transition-all">
          <div className="flex items-center gap-3">
            <Star size={16} className="text-amber-400 fill-amber-400" />
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</h4>
              <span className="text-[11px] text-slate-500">{item.type}</span>
            </div>
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={14} />
          </button>
        </div>
      ))}
      {mockFavorites.length === 0 && (
        <div className="text-center p-6 text-sm text-slate-500">
          Nenhum favorito salvo ainda.
        </div>
      )}
    </div>
  );
}

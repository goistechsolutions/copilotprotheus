import React from 'react';
import { Star, ExternalLink, Play, Trash2 } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function FavoritesList() {
  const { favorites, restoreDashboard, toggleFavorite, currentDashboard, loadServerFavorites } = useDashboardStore();

  React.useEffect(() => {
    if (loadServerFavorites) {
      loadServerFavorites();
    }
  }, []);

  if (!favorites || favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <Star size={32} className="mb-2 opacity-50 text-amber-400" />
        <p className="text-xs font-medium">Nenhum painel favorito salvo ainda.</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Ao visualizar um dashboard, clique no botão "Salvar Painel" para fixá-lo aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {favorites.map((item) => {
        const isCurrent = currentDashboard === item.dashboard;
        return (
          <div 
            key={item.id} 
            className={`group flex items-center justify-between rounded-xl border p-3 transition-all cursor-pointer ${
              isCurrent
                ? 'border-amber-400 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/30'
                : 'border-amber-200/60 bg-amber-50/30 hover:border-amber-300 hover:shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10'
            }`}
            onClick={() => item.dashboard && restoreDashboard(item.dashboard)}
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <Star size={16} className="text-amber-500 fill-amber-500 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</h4>
                <span className="text-[11px] text-slate-500">Salvo em {item.date || 'Recente'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button 
                title="Abrir Dashboard"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.dashboard) restoreDashboard(item.dashboard);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <Play size={13} />
              </button>
              <button 
                title="Remover dos favoritos"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.dashboard);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

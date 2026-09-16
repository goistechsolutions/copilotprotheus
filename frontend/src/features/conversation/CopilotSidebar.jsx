import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Star, 
  Clock, 
  MessageSquare, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  ChevronRight,
  Trash2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function CopilotSidebar({ onSelectConversation }) {
  const { 
    newConversation, 
    conversationsGrouped, 
    loadConversations, 
    selectConversation, 
    currentConversationId,
    removeConversation,
    favorites,
    loadServerFavorites,
    restoreDashboard,
    conversationsLoading
  } = useDashboardStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarTab, setSidebarTab] = useState('all'); // 'all' | 'favorites'

  useEffect(() => {
    loadConversations();
    if (loadServerFavorites) loadServerFavorites();
  }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    loadConversations(val);
  };

  const handleNewChat = async () => {
    await newConversation();
    if (onSelectConversation) onSelectConversation();
  };

  const sections = [
    { key: 'today', label: 'Hoje', items: conversationsGrouped.today || [] },
    { key: 'last_7_days', label: 'Últimos 7 dias', items: conversationsGrouped.last_7_days || [] },
    { key: 'older', label: 'Mais antigas', items: [...(conversationsGrouped.last_30_days || []), ...(conversationsGrouped.older || [])] },
  ];

  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 h-full flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#07111F] transition-all">
      {/* 1. Botão + Nova Conversa (Wireframe Seção 3) */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2563FF] hover:bg-[#3B82F6] text-white text-xs font-bold shadow-sm shadow-blue-500/25 transition-all cursor-pointer active:scale-98"
        >
          <Plus size={16} />
          <span>+ Nova Conversa</span>
        </button>
      </div>

      {/* 2. Área Intelligence: Executive Summary (Wireframe Seção 7) */}
      <div className="px-3.5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0D1528]/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            Executive Summary
          </span>
          <Sparkles size={11} className="text-amber-500" />
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#121E35] border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00D26A]" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Oportunidades</span>
            </div>
            <span className="text-[11px] font-bold text-[#00D26A]">2</span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#121E35] border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FFB020]" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Atenção</span>
            </div>
            <span className="text-[11px] font-bold text-[#FFB020]">1</span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#121E35] border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FF5A65]" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Risco</span>
            </div>
            <span className="text-[11px] font-bold text-[#FF5A65]">1</span>
          </div>
        </div>
      </div>

      {/* 3. Search Universal (Wireframe Seção 8) */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/60">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar Conversa, Cliente, Insight..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1528] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* 4. Abas Rápidas da Sidebar: Todas vs Favoritos */}
      <div className="flex px-3 pt-2 gap-1 border-b border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          onClick={() => setSidebarTab('all')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors ${
            sidebarTab === 'all'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Conversas
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('favorites')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors flex items-center justify-center gap-1 ${
            sidebarTab === 'favorites'
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Star size={12} className="fill-amber-500 text-amber-500" />
          <span>Favoritos</span>
        </button>
      </div>

      {/* 5. Lista Rolável: Histórico ou Favoritos (Wireframe Seção 3) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {sidebarTab === 'favorites' ? (
          /* Lista de Favoritos */
          favorites && favorites.length > 0 ? (
            <div className="space-y-1.5">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => {
                    if (fav.dashboard) restoreDashboard(fav.dashboard);
                    if (onSelectConversation) onSelectConversation();
                  }}
                  className="group flex items-center justify-between p-2.5 rounded-xl border border-amber-200/40 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-300 dark:hover:border-amber-700/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {fav.title}
                    </span>
                  </div>
                  <ChevronRight size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-400">
              Nenhum favorito salvo ainda.
            </p>
          )
        ) : (
          /* Lista Agrupada: Hoje, Últimos 7 dias, Mais antigas */
          sections.map((sec) => {
            if (sec.items.length === 0) return null;
            return (
              <div key={sec.key} className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Clock size={11} />
                  <span>{sec.label}</span>
                  <span className="font-normal text-slate-400">({sec.items.length})</span>
                </div>

                <div className="space-y-1">
                  {sec.items.map((conv) => {
                    const isSelected = currentConversationId === conv.id;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          selectConversation(conv.id);
                          if (onSelectConversation) onSelectConversation();
                        }}
                        className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500/50 dark:bg-[#121E35] text-blue-600 dark:text-blue-400 font-semibold shadow-2xs'
                            : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-[#0D1528] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <MessageSquare size={13} className={isSelected ? 'text-[#2563FF] shrink-0' : 'text-slate-400 shrink-0'} />
                          <span className="text-xs truncate">
                            {conv.title || 'Consulta sem título'}
                          </span>
                        </div>

                        <button
                          type="button"
                          title="Excluir conversa"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Excluir esta conversa?')) removeConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}


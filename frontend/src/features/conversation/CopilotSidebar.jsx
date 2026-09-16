import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Star, 
  Clock, 
  MessageSquare, 
  Trash2,
  ChevronRight,
  X,
  Settings
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function CopilotSidebar({ onSelectConversation, onClose }) {
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
    conversationsLoading,
    session
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
    if (onClose) onClose();
  };

  const sections = [
    { key: 'today', label: 'Hoje', items: conversationsGrouped.today || [] },
    { key: 'last_7_days', label: 'Últimos 7 dias', items: conversationsGrouped.last_7_days || [] },
    { key: 'older', label: 'Mais antigas', items: [...(conversationsGrouped.last_30_days || []), ...(conversationsGrouped.older || [])] },
  ];

  const moduleName = session?.module || session?.currentModule || 'SIGAFAT';
  const tenant = session?.tenantId || 'Padrão';

  return (
    <aside className="w-72 sm:w-80 h-full flex flex-col border-l border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#0B0E14] shadow-2xl transition-all">
      {/* Header do Drawer: Título e Botão Fechar */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-[#4F7CFF]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Configurações & Histórico
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar menu lateral"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Informações de Ambiente Escondidas no Menu (Oracle Online • SIGAFAT) */}
      <div className="px-4 py-3 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.05] text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00D26A]" />
          <span>Oracle Online • {moduleName}</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
          Tenant: <span className="font-mono">{tenant}</span>
          {session?.company ? ` • Emp: ${session.company}` : ''}
          {session?.branch ? ` • Fil: ${session.branch}` : ''}
        </div>
      </div>

      {/* 1. Botão + Nova Conversa */}
      <div className="p-3 border-b border-slate-100 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#4F7CFF] hover:bg-[#3D6BF0] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
        >
          <Plus size={15} />
          <span>+ Nova Conversa</span>
        </button>
      </div>

      {/* 2. Search Universal */}
      <div className="p-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar histórico..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#4F7CFF] transition-all"
          />
        </div>
      </div>

      {/* 3. Abas Rápidas da Sidebar: Conversas vs Favoritos */}
      <div className="flex px-3 pt-2 gap-1 border-b border-slate-100 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => setSidebarTab('all')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors ${
            sidebarTab === 'all'
              ? 'bg-blue-50 text-[#4F7CFF] dark:bg-[#4F7CFF]/10 dark:text-[#4F7CFF] font-bold'
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

      {/* 4. Lista Rolável: Histórico ou Favoritos */}
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
                    if (onClose) onClose();
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
                          if (onClose) onClose();
                        }}
                        className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4F7CFF] bg-[#4F7CFF]/10 text-[#4F7CFF] font-semibold'
                            : 'border-transparent hover:border-slate-200 dark:hover:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <MessageSquare size={13} className={isSelected ? 'text-[#4F7CFF] shrink-0' : 'text-slate-400 shrink-0'} />
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

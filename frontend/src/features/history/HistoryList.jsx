import React, { useState } from 'react';
import { 
  Play, 
  Clock, 
  Search, 
  MessageSquare, 
  Trash2, 
  Star, 
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';

export function HistoryList() {
  const { 
    conversationsGrouped, 
    conversationsLoading,
    loadConversations, 
    selectConversation, 
    removeConversation,
    currentConversationId,
    history: localHistory,
    restoreDashboard,
  } = useDashboardStore();

  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    loadConversations(val);
  };

  const sections = [
    { key: 'today', label: 'Hoje', items: conversationsGrouped.today || [] },
    { key: 'last_7_days', label: 'Últimos 7 dias', items: conversationsGrouped.last_7_days || [] },
    { key: 'last_30_days', label: 'Últimos 30 dias', items: conversationsGrouped.last_30_days || [] },
    { key: 'older', label: 'Mais antigas', items: conversationsGrouped.older || [] },
  ];

  const totalServerConversations = sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Campo de Busca Instantânea */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar Conversa ou Pergunta..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      {conversationsLoading && (
        <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
          Carregando conversas...
        </div>
      )}

      {/* Listas Agrupadas por Período */}
      {totalServerConversations > 0 ? (
        <div className="flex flex-col gap-6">
          {sections.map((sec) => {
            if (sec.items.length === 0) return null;
            return (
              <div key={sec.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Calendar size={12} />
                  <span>{sec.label}</span>
                  <span className="text-[10px] font-normal text-slate-400">({sec.items.length})</span>
                </div>

                <div className="flex flex-col gap-2">
                  {sec.items.map((conv) => {
                    const isSelected = currentConversationId === conv.id;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv.id)}
                        className={`group rounded-xl border p-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:border-blue-500/60 dark:bg-blue-900/20 shadow-sm'
                            : 'border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                              isSelected 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:text-blue-600'
                            }`}>
                              <MessageSquare size={13} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {conv.title || 'Consulta sem título'}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <span>{conv.message_count || 0} mensagens</span>
                                <span>•</span>
                                <span>{conv.dashboard_count || 0} dashboards</span>
                                {conv.domain_code && (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      {conv.domain_code}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {conv.is_favorite && (
                              <Star size={13} className="text-amber-500 fill-amber-500" />
                            )}
                            <button
                              title="Remover conversa"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Deseja excluir "${conv.title}"?`)) {
                                  removeConversation(conv.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !conversationsLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <Clock size={32} className="mb-2 opacity-40" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {searchTerm ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa salva ainda.'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
              {searchTerm 
                ? 'Tente pesquisar com outros termos ou limpe o campo de busca.'
                : 'Inicie uma pergunta no chat para gerar análises e dashboards executivos.'}
            </p>
          </div>
        )
      )}

      {/* Seção adicional de Dashboards Locais Recentes (se houver) */}
      {localHistory && localHistory.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Layers size={12} />
            <span>Dashboards Recentes nesta Sessão ({localHistory.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {localHistory.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => item.dashboard && restoreDashboard(item.dashboard)}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800/50 dark:bg-slate-900/40 hover:border-blue-300 cursor-pointer transition-all"
              >
                <div className="min-w-0 pr-2">
                  <h5 className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.title}
                  </h5>
                  <span className="text-[10px] text-slate-400">
                    {item.timestamp || item.date}
                  </span>
                </div>
                <button
                  title="Abrir Dashboard"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Play size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


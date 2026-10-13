import React, { useEffect, useState, useMemo } from 'react';
import { ConversationItem, CopilotSessionContext } from '../types/chat.types';
import { fetchConversationList } from '../services/copilotChatApi';
import { PlusIcon } from './icons';
import { Search, Star, MessageSquare, ChevronLeft, ChevronRight, MoreVertical, Trash2 } from 'lucide-react';

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  context?: CopilotSessionContext;
}

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  context,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('copilot_favorite_conversations') || '[]');
    } catch {
      return [];
    }
  });

  const contextKey = JSON.stringify(context || {});

  useEffect(() => {
    setLoading(true);
    fetchConversationList(context)
      .then((data) => setConversations(data))
      .finally(() => setLoading(false));
  }, [contextKey]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem('copilot_favorite_conversations', JSON.stringify(updated));
      return updated;
    });
  };

  // Filtragem de busca
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(term) ||
        (c.lastMessagePreview || '').toLowerCase().includes(term)
    );
  }, [conversations, searchTerm]);

  // Agrupamento temporal: Hoje, Ontem, Últimos 7 dias e Anteriores
  const groups = useMemo(() => {
    const today: ConversationItem[] = [];
    const yesterday: ConversationItem[] = [];
    const last7Days: ConversationItem[] = [];
    const older: ConversationItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayStart = todayStart - oneDayMs;
    const sevenDaysStart = todayStart - 7 * oneDayMs;

    filteredConversations.forEach((item) => {
      const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : todayStart;

      if (itemTime >= todayStart) {
        today.push(item);
      } else if (itemTime >= yesterdayStart) {
        yesterday.push(item);
      } else if (itemTime >= sevenDaysStart) {
        last7Days.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, last7Days, older };
  }, [filteredConversations]);

  const favoriteItems = useMemo(() => {
    return filteredConversations.filter((c) => favorites.includes(c.id));
  }, [filteredConversations, favorites]);

  if (isCollapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-[var(--cprot-border)] bg-[var(--cprot-bg)] flex flex-col items-center py-3 gap-3 transition-all z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg text-[var(--cprot-text-muted)] hover:text-[var(--cprot-text-main)] hover:bg-[var(--cprot-surface)] transition-colors cursor-pointer"
          title="Expandir barra lateral"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg bg-[var(--cprot-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          title="Nova Conversa"
        >
          <PlusIcon size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] shrink-0 border-r border-[var(--cprot-border)] bg-[var(--cprot-bg)] flex flex-col p-3 overflow-hidden transition-all z-10">
      {/* Top Header da Sidebar: Nova Conversa + Botão Recolher */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] hover:border-[var(--cprot-border-focus)] text-[var(--cprot-text-main)] rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs"
        >
          <PlusIcon size={14} />
          <span>Nova Conversa</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-2 rounded-xl text-[var(--cprot-text-muted)] hover:text-[var(--cprot-text-main)] hover:bg-[var(--cprot-surface)] border border-transparent hover:border-[var(--cprot-border)] transition-colors cursor-pointer"
          title="Recolher barra lateral"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Campo de Busca no Topo */}
      <div className="relative mb-3">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cprot-text-muted)] pointer-events-none"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar no histórico..."
          className="w-full pl-8 pr-3 py-1.5 bg-[var(--cprot-input-bg)] border border-[var(--cprot-border)] focus:border-[var(--cprot-border-focus)] text-[var(--cprot-text-main)] placeholder-[var(--cprot-text-muted)] rounded-lg text-xs outline-none transition-colors"
        />
      </div>

      {/* Lista de Conversas com Agrupamento Temporal */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
        {/* Favoritos */}
        {favoriteItems.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--cprot-text-muted)] uppercase tracking-wider mb-1.5 px-2 flex items-center gap-1.5">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              <span>Favoritos</span>
            </h3>
            <div className="space-y-0.5">
              {favoriteItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentConversationId === item.id}
                  isFavorite={true}
                  onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  onClick={() => onSelectConversation(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hoje */}
        {groups.today.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--cprot-text-muted)] uppercase tracking-wider mb-1.5 px-2">
              Hoje
            </h3>
            <div className="space-y-0.5">
              {groups.today.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentConversationId === item.id}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  onClick={() => onSelectConversation(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ontem */}
        {groups.yesterday.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--cprot-text-muted)] uppercase tracking-wider mb-1.5 px-2">
              Ontem
            </h3>
            <div className="space-y-0.5">
              {groups.yesterday.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentConversationId === item.id}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  onClick={() => onSelectConversation(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Últimos 7 dias */}
        {groups.last7Days.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--cprot-text-muted)] uppercase tracking-wider mb-1.5 px-2">
              Últimos 7 dias
            </h3>
            <div className="space-y-0.5">
              {groups.last7Days.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentConversationId === item.id}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  onClick={() => onSelectConversation(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Anteriores */}
        {groups.older.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--cprot-text-muted)] uppercase tracking-wider mb-1.5 px-2">
              Anteriores
            </h3>
            <div className="space-y-0.5">
              {groups.older.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentConversationId === item.id}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  onClick={() => onSelectConversation(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {filteredConversations.length === 0 && !loading && (
          <div className="text-center py-6 px-2 text-[11px] text-[var(--cprot-text-muted)]">
            Nenhuma conversa encontrada
          </div>
        )}
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  item: ConversationItem;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function SidebarItem({
  item,
  isActive,
  isFavorite,
  onToggleFavorite,
  onClick,
}: SidebarItemProps) {
  const title = item.title || 'Conversa sem título';

  return (
    <div
      onClick={onClick}
      title={title}
      className={`group relative flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--cprot-surface)] text-[var(--cprot-text-main)] font-medium border border-[var(--cprot-border-focus)]'
          : 'text-[var(--cprot-text-sub)] hover:bg-[var(--cprot-surface)]/60 hover:text-[var(--cprot-text-main)] border border-transparent'
      }`}
    >
      <MessageSquare
        size={13}
        className={`shrink-0 ${
          isActive ? 'text-[var(--cprot-primary)]' : 'text-[var(--cprot-text-muted)] group-hover:text-[var(--cprot-text-sub)]'
        }`}
      />

      <span className="flex-1 text-xs truncate">{title}</span>

      <button
        type="button"
        onClick={onToggleFavorite}
        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 dark:hover:bg-white/10 ${
          isFavorite ? '!opacity-100 text-amber-400' : 'text-[var(--cprot-text-muted)]'
        }`}
        title={isFavorite ? 'Remover dos favoritos' : 'Favoritar conversa'}
      >
        <Star size={11} className={isFavorite ? 'fill-amber-400' : ''} />
      </button>
    </div>
  );
}

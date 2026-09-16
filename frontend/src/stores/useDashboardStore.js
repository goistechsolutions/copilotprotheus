import { create } from 'zustand';
import {
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  addConversationMessage,
  addConversationDashboard,
  getFavorites,
  toggleConversationFavorite,
} from '../services/api';

/**
 * Store centralizado para gerenciar o estado da plataforma.
 * Responsável por: Sessão, Conversas Persistentes (Chat 2.0), Dashboard Atual, Histórico, Chat e Configurações.
 */
export const useDashboardStore = create((set, get) => ({
  // Sessão
  session: {
    tenantId: null,
    environment: null,
    userId: null,
    isAuthenticated: false,
  },
  setSession: (sessionData) => set((state) => ({ 
    session: { ...state.session, ...sessionData } 
  })),

  // ==========================================
  // Copilot Chat 2.0: Conversas Persistentes
  // ==========================================
  currentConversationId: null,
  activeConversation: null,
  conversationsGrouped: {
    today: [],
    last_7_days: [],
    last_30_days: [],
    older: [],
  },
  conversationsLoading: false,
  conversationsSearchQuery: '',
  setSearchQuery: (q) => set({ conversationsSearchQuery: q }),

  // Carrega lista de conversas com agrupamento temporal do backend
  loadConversations: async (search = '') => {
    set({ conversationsLoading: true });
    try {
      const { session } = get();
      const res = await getConversations({
        tenant_id: session?.tenantId || undefined,
        user_id: session?.userId || undefined,
        q: search || undefined,
      });
      if (res && res.grouped) {
        set({ conversationsGrouped: res.grouped, conversationsLoading: false });
      } else {
        set({ conversationsLoading: false });
      }
    } catch (err) {
      console.warn('Erro ao carregar conversas:', err);
      set({ conversationsLoading: false });
    }
  },

  // Inicia uma Nova Conversa limpa
  newConversation: async (title = 'Nova Conversa') => {
    const { session } = get();
    try {
      const res = await createConversation({
        title,
        tenant_id: session?.tenantId || 'padrao',
        user_id: session?.userId || 'default_user',
        domain_code: session?.module || 'SIGAFAT',
      });
      const convId = res.conversation_id;
      set({
        currentConversationId: convId,
        activeConversation: { id: convId, title, is_favorite: false },
        currentDashboard: null,
        chat: { messages: [], isOpen: true },
      });
      get().loadConversations(get().conversationsSearchQuery);
      return convId;
    } catch (err) {
      console.error('Erro ao criar conversa no backend:', err);
      const fallbackId = `conv_${Date.now()}`;
      set({
        currentConversationId: fallbackId,
        activeConversation: { id: fallbackId, title, is_favorite: false },
        currentDashboard: null,
        chat: { messages: [], isOpen: true },
      });
      return fallbackId;
    }
  },

  // Seleciona e restaura uma conversa existente
  selectConversation: async (conversationId) => {
    if (!conversationId) return;
    try {
      const data = await getConversation(conversationId);
      if (data && data.conversation) {
        const conv = data.conversation;
        const messages = (data.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.message,
          metadata: m.metadata || {},
          timestamp: m.created_at || new Date().toISOString(),
          dashboard: m.metadata?.dashboard || null,
          suggestions: m.metadata?.suggestions || [],
          originPrompt: m.metadata?.originPrompt || '',
        }));

        // Se houver dashboards vinculados, restaura o último gerado
        let latestDashboard = null;
        if (data.dashboards && data.dashboards.length > 0) {
          const lastDash = data.dashboards[data.dashboards.length - 1];
          latestDashboard = lastDash.dashboard_json || null;
        }

        set({
          currentConversationId: conversationId,
          activeConversation: conv,
          chat: { messages, isOpen: true },
          currentDashboard: latestDashboard,
        });
      }
    } catch (err) {
      console.error('Erro ao restaurar conversa:', err);
    }
  },

  // Remove uma conversa
  removeConversation: async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      const { currentConversationId } = get();
      if (currentConversationId === conversationId) {
        await get().newConversation();
      } else {
        get().loadConversations(get().conversationsSearchQuery);
      }
    } catch (err) {
      console.error('Erro ao deletar conversa:', err);
    }
  },

  // Sincroniza mensagem no backend
  syncMessage: async (conversationId, role, message, metadata = {}) => {
    if (!conversationId) return;
    try {
      await addConversationMessage(conversationId, {
        role,
        message,
        metadata,
      });
      // Atualiza lista lateral de conversas (para refletir auto-título na primeira mensagem)
      get().loadConversations(get().conversationsSearchQuery);
    } catch (err) {
      console.warn('Erro ao sincronizar mensagem:', err);
    }
  },

  // Sincroniza dashboard gerado no backend
  syncDashboard: async (conversationId, title, dashboardJson, insightJson = null, query = '') => {
    if (!conversationId) return;
    try {
      await addConversationDashboard(conversationId, {
        title: title || 'Dashboard Executivo',
        dashboard_type: dashboardJson?.screenType || 'ranking',
        query,
        dashboard_json: dashboardJson,
        insight_json: insightJson,
      });
    } catch (err) {
      console.warn('Erro ao sincronizar dashboard:', err);
    }
  },

  // Dashboard Atual (Dashboard Engine State)
  currentDashboard: null,
  isGenerating: false,
  setDashboard: (dashboardData) => set({ currentDashboard: dashboardData }),
  setIsGenerating: (status) => set({ isGenerating: status }),

  // Chat
  chat: {
    messages: [],
    isOpen: true,
  },
  addChatMessage: (message) => set((state) => ({
    chat: { ...state.chat, messages: [...state.chat.messages, message] }
  })),
  toggleChat: () => set((state) => ({
    chat: { ...state.chat, isOpen: !state.chat.isOpen }
  })),

  // Estado de Processamento Progressivo (6 etapas)
  processingStep: 1,
  setProcessingStep: (step) => set({ processingStep: step }),

  // Disparo de Prompt Programático (Drill-down e Sugestões)
  pendingPrompt: null,
  triggerPrompt: (promptText) => set({ pendingPrompt: promptText }),
  clearPendingPrompt: () => set({ pendingPrompt: null }),

  // Histórico local e Favoritos
  history: [],
  addToHistory: (entry) => set((state) => {
    const newEntry = {
      id: entry.id || Date.now().toString(),
      prompt: entry.prompt || '',
      title: entry.title || entry.prompt || 'Análise Executiva',
      timestamp: entry.timestamp || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: entry.date || 'Hoje',
      type: entry.dashboard ? 'Dashboard' : 'Consulta',
      screenType: entry.dashboard?.screenType || 'ranking',
      dashboard: entry.dashboard || null,
    };
    return {
      history: [newEntry, ...state.history.filter(h => h.prompt !== entry.prompt)].slice(0, 30)
    };
  }),
  restoreDashboard: (dashboard) => set({ currentDashboard: dashboard }),
  closeDashboard: () => set({ currentDashboard: null }),
  
  favorites: [],
  loadServerFavorites: async () => {
    try {
      const { session } = get();
      const res = await getFavorites(session?.tenantId);
      if (res && res.dashboards) {
        const mapped = res.dashboards.map((d) => ({
          id: d.id,
          title: d.title,
          date: d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : 'Recente',
          dashboard: d.dashboard_json,
        }));
        set({ favorites: mapped });
      }
    } catch (e) {
      console.warn('Erro ao carregar favoritos do servidor:', e);
    }
  },
  toggleFavorite: (dashboard) => set((state) => {
    if (!dashboard) return state;
    const exists = state.favorites.some(f => f.originPrompt === dashboard.originPrompt || (f.id && f.id === dashboard.id));
    if (exists) {
      return {
        favorites: state.favorites.filter(f => f.originPrompt !== dashboard.originPrompt && f.id !== dashboard.id)
      };
    } else {
      const fav = {
        id: dashboard.id || Date.now().toString(),
        title: dashboard.originPrompt || 'Painel Salvo',
        date: new Date().toLocaleDateString('pt-BR'),
        dashboard: dashboard,
      };
      return { favorites: [fav, ...state.favorites] };
    }
  }),

  // Configurações e Modo Executivo / Analítico
  executiveMode: false,
  setExecutiveMode: (val) => set({ executiveMode: !!val }),
  toggleExecutiveMode: () => set((state) => ({ executiveMode: !state.executiveMode })),

  config: {
    theme: typeof window !== 'undefined' ? (localStorage.getItem('theme') || 'system') : 'system', 
  },
  setConfig: (configData) => set((state) => ({
    config: { ...state.config, ...configData }
  })),
}));


import { create } from 'zustand';

/**
 * Store centralizado para gerenciar o estado da plataforma.
 * Responsável por: Sessão, Dashboard Atual, Histórico, Chat, e Configurações.
 */
export const useDashboardStore = create((set) => ({
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

  // Dashboard Atual (Dashboard Engine State)
  currentDashboard: null, // O contrato completo retornado pela IA (charts, kpis, type)
  isGenerating: false, // Se a IA está gerando/processando o dashboard no momento
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

  // Histórico e Favoritos
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

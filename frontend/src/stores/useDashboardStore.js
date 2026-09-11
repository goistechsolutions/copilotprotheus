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

  // Histórico e Favoritos (Mock inicial)
  history: [],
  favorites: [],

  // Configurações
  config: {
    theme: typeof window !== 'undefined' ? (localStorage.getItem('theme') || 'system') : 'system', 
  },
  setConfig: (configData) => set((state) => ({
    config: { ...state.config, ...configData }
  })),
}));

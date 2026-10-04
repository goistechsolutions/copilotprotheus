import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CopilotMessage, 
  CopilotSessionContext 
} from '../types/chat.types';
import { 
  askCopilotQuery, 
  createNewConversationRemote, 
  fetchConversationMessagesRemote 
} from '../services/copilotChatApi';

const ACTIVE_CONV_STORAGE_PREFIX = 'cprot_active_conversation_id';

function storageScope(context?: CopilotSessionContext): string {
  return [
    context?.tenantId,
    context?.userId,
    context?.company,
    context?.branch,
    context?.environment,
    context?.module || context?.currentModule,
  ].map((value) => encodeURIComponent(String(value || 'unknown'))).join(':');
}

function activeConversationKey(context?: CopilotSessionContext): string {
  return `${ACTIVE_CONV_STORAGE_PREFIX}:${storageScope(context)}`;
}

export function useCopilotConversation(context?: CopilotSessionContext) {
  const activeConversationStorageKey = activeConversationKey(context);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem(activeConversationStorageKey) || null;
  });
  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const contextKey = JSON.stringify(context || {});

  // Restaura do backend que continua sendo a fonte canônica.
  useEffect(() => {
    if (currentConversationId) {
      fetchConversationMessagesRemote(currentConversationId).then((loaded) => {
        if (loaded && loaded.length > 0) {
          setMessages((prev) => {
            // Preserva qualquer mensagem de processamento que tenha sido adicionada localmente
            // enquanto a requisicao de fetch estava em andamento.
            const processingMsgs = prev.filter((m) => m.status === 'processing');
            if (processingMsgs.length > 0) {
              return [...loaded, ...processingMsgs];
            }
            return loaded;
          });
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, contextKey]);

  const stopProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    // Remove ou marca a mensagem de processamento
    setMessages((prev) => prev.filter((m) => m.status !== 'processing'));
  }, []);

  const startNewConversation = useCallback(() => {
    stopProcessing();
    setCurrentConversationId(null);
    localStorage.removeItem(activeConversationStorageKey);
    setMessages([]);
  }, [activeConversationStorageKey, stopProcessing]);

  const selectConversation = useCallback(async (conversationId: string) => {
    stopProcessing();
    setCurrentConversationId(conversationId);
    localStorage.setItem(activeConversationStorageKey, conversationId);
    setMessages([]);
    try {
      const msgs = await fetchConversationMessagesRemote(conversationId);
      if (msgs.length > 0) {
        setMessages(msgs);
      }
    } catch {
      setMessages([]);
    }
  }, [activeConversationStorageKey, context, stopProcessing]);

  const sendMessage = useCallback(async (promptText: string) => {
    const text = promptText.trim();
    if (!text || isProcessing) return;

    const userMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
    const processingMessageId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + 1).toString();

    // 1. Garante ou cria a conversa no backend
    let convId = currentConversationId;
    if (!convId) {
      convId = await createNewConversationRemote(text.slice(0, 40), context);
      setCurrentConversationId(convId);
      localStorage.setItem(activeConversationStorageKey, convId);
    }

    // 2. Adiciona mensagem do usuário e mensagem provisória de processamento
    const userMsg: CopilotMessage = {
      id: userMessageId,
      clientMessageId: userMessageId,
      role: 'user',
      content: text,
      status: 'done',
      timestamp: new Date().toISOString(),
    };

    const provMsg: CopilotMessage = {
      id: processingMessageId,
      role: 'assistant',
      content: 'Processando...',
      status: 'processing',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, provMsg]);
    setIsProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await askCopilotQuery(convId, text, context, controller.signal);

      const dbRef = response.dashboardId ? {
        id: response.dashboardId,
        analysisId: response.analysisId,
        title: text,
        originPrompt: text,
        payload: response.dashboard
      } : response.dashboard;

      // 3. Substitui mensagem provisória pela resposta definitiva
      const assistantMsg: CopilotMessage = {
        id: processingMessageId,
        role: 'assistant',
        content: response.content,
        status: 'done',
        timestamp: new Date().toISOString(),
        dashboard: dbRef || null,
        suggestions: response.suggestions || [],
      };

      setMessages((prev) => 
        prev.map((m) => (m.id === processingMessageId ? assistantMsg : m))
      );

    } catch (err: any) {
      if (err.name === 'AbortError') return;

      const errorMsg: CopilotMessage = {
        id: processingMessageId,
        role: 'assistant',
        content: err.message || 'Ocorreu um erro ao processar sua consulta. Tente novamente.',
        status: 'error',
        errorCode: 'QUERY_EXECUTION_ERROR',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => 
        prev.map((m) => (m.id === processingMessageId ? errorMsg : m))
      );
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [activeConversationStorageKey, currentConversationId, isProcessing, context]);

  return {
    messages,
    isProcessing,
    currentConversationId,
    sendMessage,
    stopProcessing,
    startNewConversation,
    selectConversation,
  };
}

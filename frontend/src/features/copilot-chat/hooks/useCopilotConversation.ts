import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CopilotMessage, 
  CopilotSessionContext 
} from '../types/chat.types';
import { 
  askCopilotQuery, 
  createNewConversationRemote, 
  fetchConversationMessagesRemote, 
  syncRemoteMessage 
} from '../services/copilotChatApi';

const ACTIVE_CONV_STORAGE_KEY = 'cprot_active_conversation_id';

export function useCopilotConversation(context?: CopilotSessionContext) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_CONV_STORAGE_KEY) || null;
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Carrega mensagens da conversa salva se houver
  useEffect(() => {
    if (currentConversationId) {
      fetchConversationMessagesRemote(currentConversationId).then((loaded) => {
        if (loaded && loaded.length > 0) {
          setMessages(loaded);
        }
      }).catch(() => {});
    }
  }, [currentConversationId]);

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
    localStorage.removeItem(ACTIVE_CONV_STORAGE_KEY);
    setMessages([]);
  }, [stopProcessing]);

  const selectConversation = useCallback(async (conversationId: string) => {
    stopProcessing();
    setCurrentConversationId(conversationId);
    localStorage.setItem(ACTIVE_CONV_STORAGE_KEY, conversationId);
    try {
      const msgs = await fetchConversationMessagesRemote(conversationId);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  }, [stopProcessing]);

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
      localStorage.setItem(ACTIVE_CONV_STORAGE_KEY, convId);
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
      content: 'Consultando banco de dados Oracle...',
      status: 'processing',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, provMsg]);
    setIsProcessing(true);

    // Sincroniza pergunta do usuário no backend
    syncRemoteMessage(convId, 'user', text, { originPrompt: text });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await askCopilotQuery(text, context, controller.signal);

      // 3. Substitui mensagem provisória pela resposta definitiva
      const assistantMsg: CopilotMessage = {
        id: processingMessageId,
        role: 'assistant',
        content: response.content,
        status: 'done',
        timestamp: new Date().toISOString(),
        dashboard: response.dashboard || null,
        suggestions: response.suggestions || [],
      };

      setMessages((prev) => 
        prev.map((m) => (m.id === processingMessageId ? assistantMsg : m))
      );

      // Sincroniza resposta no backend
      syncRemoteMessage(convId, 'assistant', response.content, {
        originPrompt: text,
        dashboard: response.dashboard,
        suggestions: response.suggestions,
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;

      const errorMsg: CopilotMessage = {
        id: processingMessageId,
        role: 'assistant',
        content: err.message || 'Ocorreu um erro ao processar sua consulta.',
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
  }, [currentConversationId, isProcessing, context]);

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

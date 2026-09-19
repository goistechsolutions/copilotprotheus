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

const ACTIVE_CONV_STORAGE_PREFIX = 'cprot_active_conversation_id';
const MESSAGE_SNAPSHOT_PREFIX = 'cprot_conversation_messages';

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

function messageSnapshotKey(context: CopilotSessionContext | undefined, conversationId: string): string {
  return `${MESSAGE_SNAPSHOT_PREFIX}:${storageScope(context)}:${encodeURIComponent(conversationId)}`;
}

function readMessageSnapshot(context: CopilotSessionContext | undefined, conversationId: string): CopilotMessage[] {
  try {
    const saved = localStorage.getItem(messageSnapshotKey(context, conversationId));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((message) => message?.status !== 'processing') : [];
  } catch {
    return [];
  }
}

function writeMessageSnapshot(context: CopilotSessionContext | undefined, conversationId: string, messages: CopilotMessage[]): void {
  try {
    const stableMessages = messages.filter((message) => message?.status !== 'processing');
    localStorage.setItem(messageSnapshotKey(context, conversationId), JSON.stringify(stableMessages));
  } catch {
    // A falha de storage não pode impedir a conversa remota.
  }
}

export function useCopilotConversation(context?: CopilotSessionContext) {
  const activeConversationStorageKey = activeConversationKey(context);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    return localStorage.getItem(activeConversationStorageKey) || null;
  });
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    const conversationId = localStorage.getItem(activeConversationStorageKey);
    return conversationId ? readMessageSnapshot(context, conversationId) : [];
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Restaura imediatamente do snapshot; o backend continua sendo a fonte canônica.
  useEffect(() => {
    if (currentConversationId) {
      const snapshot = readMessageSnapshot(context, currentConversationId);
      if (snapshot.length > 0) setMessages(snapshot);
      fetchConversationMessagesRemote(currentConversationId).then((loaded) => {
        if (loaded && loaded.length > 0) {
          setMessages(loaded);
          writeMessageSnapshot(context, currentConversationId, loaded);
        }
      }).catch(() => {});
    }
  }, [currentConversationId, context]);

  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      writeMessageSnapshot(context, currentConversationId, messages);
    }
  }, [context, currentConversationId, messages]);

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
    const snapshot = readMessageSnapshot(context, conversationId);
    setMessages(snapshot);
    try {
      const msgs = await fetchConversationMessagesRemote(conversationId);
      if (msgs.length > 0) {
        setMessages(msgs);
        writeMessageSnapshot(context, conversationId, msgs);
      }
    } catch {
      if (snapshot.length === 0) setMessages([]);
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

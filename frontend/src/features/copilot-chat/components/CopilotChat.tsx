import React, { useState, useEffect, useCallback } from 'react';
import '../styles/copilot-chat.css';
import { CopilotSessionContext, CopilotDashboardReference } from '../types/chat.types';
import { useCopilotConversation } from '../hooks/useCopilotConversation';
import { ChatHeader } from './ChatHeader';
import { Conversation } from './Conversation';
import { ChatComposer } from './ChatComposer';
import { SecondaryMenu } from './SecondaryMenu';
import { HistoryDrawer } from './HistoryDrawer';

export interface CopilotChatProps {
  context?: CopilotSessionContext;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
  onClose?: () => void;
  className?: string;
}

export function CopilotChat({
  context,
  onOpenDashboard,
  onClose,
  className = '',
}: CopilotChatProps) {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const {
    messages,
    isProcessing,
    currentConversationId,
    sendMessage,
    stopProcessing,
    startNewConversation,
    selectConversation,
  } = useCopilotConversation(context);

  // Manipulação de eventos customizados globais
  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('copilot:open-settings'));
  }, []);

  const handleSelectPrompt = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  return (
    <div className={`copilot-chat-container ${className}`}>
      {/* 10% Header */}
      <ChatHeader
        onOpenMenu={() => setIsMenuOpen((prev) => !prev)}
        onClose={onClose}
        isConnected={true}
      />

      {/* Menu Secundário Suspenso */}
      <SecondaryMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNewConversation={startNewConversation}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={handleOpenSettings}
      />

      {/* Drawer Temporário de Histórico */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentConversationId={currentConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
        context={context}
      />

      {/* 80% Conversa / Estado Inicial */}
      <Conversation
        messages={messages}
        conversationId={currentConversationId || undefined}
        onSelectPrompt={handleSelectPrompt}
        onOpenDashboard={onOpenDashboard}
        onStopProcessing={stopProcessing}
        onRetryLast={() => {
          const lastUser = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUser) sendMessage(lastUser.content);
        }}
      />

      {/* 10% Input */}
      <ChatComposer
        onSendMessage={sendMessage}
        onStopProcessing={stopProcessing}
        isProcessing={isProcessing}
        hasMessages={messages.length > 0}
      />
    </div>
  );
}

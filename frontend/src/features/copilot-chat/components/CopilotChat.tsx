import React, { useState, useEffect, useCallback } from 'react';
import '../styles/copilot-chat.css';
import { CopilotSessionContext, CopilotDashboardReference } from '../types/chat.types';
import { useCopilotConversation } from '../hooks/useCopilotConversation';
import { ChatHeader } from './ChatHeader';
import { Conversation } from './Conversation';
import { ChatComposer } from './ChatComposer';
import { SecondaryMenu } from './SecondaryMenu';
import { Sidebar } from './Sidebar';

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

  const {
    messages,
    isProcessing,
    currentConversationId,
    sendMessage,
    stopProcessing,
    startNewConversation,
    selectConversation,
  } = useCopilotConversation(context);

  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('copilot:open-settings'));
  }, []);

  const handleSelectPrompt = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  return (
    <div className={`copilot-chat-container ${className}`}>
      {/* HEADER */}
      <ChatHeader
        onOpenMenu={() => setIsMenuOpen((prev) => !prev)}
        onClose={onClose}
        isConnected={true}
      />

      <SecondaryMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNewConversation={startNewConversation}
        onOpenHistory={() => {}}
        onOpenSettings={handleOpenSettings}
      />

      {/* WORKSPACE (Sidebar + Conversation Area) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar 
          currentConversationId={currentConversationId}
          onSelectConversation={selectConversation}
          onNewConversation={startNewConversation}
          context={context}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Conversation Area */}
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

          {/* INPUT BAR */}
          <ChatComposer
            onSendMessage={sendMessage}
            onStopProcessing={stopProcessing}
            isProcessing={isProcessing}
            hasMessages={messages.length > 0}
          />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { CopilotMessage, CopilotDashboardReference } from '../types/chat.types';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { EmptyConversation } from './EmptyConversation';
import { MessageList } from './MessageList';

interface ConversationProps {
  messages: CopilotMessage[];
  conversationId?: string;
  onSelectPrompt: (prompt: string) => void;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
  onStopProcessing?: () => void;
  onRetryLast?: () => void;
}

export function Conversation({
  messages,
  conversationId,
  onSelectPrompt,
  onOpenDashboard,
  onStopProcessing,
  onRetryLast,
}: ConversationProps) {
  const { containerRef, handleScroll } = useAutoScroll<HTMLDivElement>([messages]);

  return (
    <main
      className="copilot-chat-conversation"
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 ? (
        <EmptyConversation onSelectPrompt={onSelectPrompt} />
      ) : (
        <MessageList
          messages={messages}
          conversationId={conversationId}
          onSelectSuggestion={onSelectPrompt}
          onOpenDashboard={onOpenDashboard}
          onStopProcessing={onStopProcessing}
          onRetryLast={onRetryLast}
        />
      )}
    </main>
  );
}

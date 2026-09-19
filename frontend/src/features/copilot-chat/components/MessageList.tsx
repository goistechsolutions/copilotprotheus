import React from 'react';
import { CopilotMessage, CopilotDashboardReference } from '../types/chat.types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface MessageListProps {
  messages: CopilotMessage[];
  conversationId?: string;
  onSelectSuggestion: (prompt: string) => void;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
  onStopProcessing?: () => void;
  onRetryLast?: () => void;
}

export function MessageList({
  messages,
  conversationId,
  onSelectSuggestion,
  onOpenDashboard,
  onStopProcessing,
  onRetryLast,
}: MessageListProps) {
  return (
    <div className="copilot-message-list">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isLast = index === messages.length - 1;

        return (
          <React.Fragment key={message.id || index}>
            {isUser ? (
              <UserMessage message={message} />
            ) : (
              <AssistantMessage
                message={message}
                conversationId={conversationId}
                onSelectSuggestion={onSelectSuggestion}
                onOpenDashboard={onOpenDashboard}
                onStopProcessing={onStopProcessing}
                onRetry={isLast ? onRetryLast : undefined}
              />
            )}

            {!isUser && !isLast && (
              <div className="copilot-turn-divider" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

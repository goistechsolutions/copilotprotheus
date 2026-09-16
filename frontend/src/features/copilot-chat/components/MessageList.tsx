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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '680px',
      margin: '0 auto',
    }}>
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

            {/* Divisória minimalista entre turnos completos (quando a próxima for do usuário) */}
            {!isUser && !isLast && (
              <div style={{
                width: '100%',
                height: '1px',
                backgroundColor: 'var(--cprot-border)',
                marginBottom: '28px',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

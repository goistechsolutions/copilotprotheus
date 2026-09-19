import React from 'react';
import { CopilotMessage, CopilotDashboardReference } from '../types/chat.types';
import { AnalysisAnswer } from './AnalysisAnswer';
import { FollowUpSuggestions } from './FollowUpSuggestions';
import { ProcessingMessage } from './ProcessingMessage';
import { ErrorMessage } from './ErrorMessage';

interface AssistantMessageProps {
  message: CopilotMessage;
  conversationId?: string;
  onSelectSuggestion: (prompt: string) => void;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
  onStopProcessing?: () => void;
  onRetry?: () => void;
}

export function AssistantMessage({
  message,
  conversationId,
  onSelectSuggestion,
  onOpenDashboard,
  onStopProcessing,
  onRetry,
}: AssistantMessageProps) {
  if (message.status === 'processing') {
    return <ProcessingMessage onStop={onStopProcessing} text={message.content} />;
  }

  if (message.status === 'error') {
    return <ErrorMessage message={message.content} onRetry={onRetry} />;
  }

  return (
    <div className="copilot-assistant-turn animate-fade-in">
      <div className="copilot-message-label"><span className="copilot-label-dot" /> Análise concluída</div>
      <AnalysisAnswer
        content={message.content}
        dashboard={message.dashboard}
        conversationId={conversationId}
        messageId={message.id}
        onOpenDashboard={onOpenDashboard}
      />

      {message.suggestions && message.suggestions.length > 0 && (
        <FollowUpSuggestions
          suggestions={message.suggestions}
          onSelectSuggestion={onSelectSuggestion}
        />
      )}
    </div>
  );
}

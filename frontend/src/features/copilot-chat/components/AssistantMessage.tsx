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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: '28px',
    }} className="animate-fade-in">
      {/* Rótulo Superior */}
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--cprot-primary)',
        marginBottom: '8px',
      }}>
        Análise concluída
      </span>

      {/* Resposta Analítica e Ação de Dashboard */}
      <AnalysisAnswer
        content={message.content}
        dashboard={message.dashboard}
        conversationId={conversationId}
        messageId={message.id}
        onOpenDashboard={onOpenDashboard}
      />

      {/* Sugestões Contextuais (Aparecem somente após resposta) */}
      {message.suggestions && message.suggestions.length > 0 && (
        <FollowUpSuggestions
          suggestions={message.suggestions}
          onSelectSuggestion={onSelectSuggestion}
        />
      )}
    </div>
  );
}

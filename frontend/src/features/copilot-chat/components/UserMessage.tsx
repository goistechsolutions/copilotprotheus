import React from 'react';
import { CopilotMessage } from '../types/chat.types';

interface UserMessageProps {
  message: CopilotMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      width: '100%',
      marginBottom: '20px',
    }} className="animate-fade-in">
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--cprot-text-muted)',
        marginBottom: '6px',
        paddingRight: '2px',
      }}>
        Você
      </span>
      <div style={{
        maxWidth: '85%',
        fontSize: '15px',
        lineHeight: 1.5,
        color: 'var(--cprot-text-main)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: 'right',
      }}>
        {message.content}
      </div>
    </div>
  );
}

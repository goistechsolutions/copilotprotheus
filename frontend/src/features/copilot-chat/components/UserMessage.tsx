import React from 'react';
import { CopilotMessage } from '../types/chat.types';

interface UserMessageProps {
  message: CopilotMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="copilot-user-turn animate-fade-in">
      <span className="copilot-message-label">Você</span>
      <div className="copilot-user-bubble">{message.content}</div>
    </div>
  );
}

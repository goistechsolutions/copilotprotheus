import React, { useState } from 'react';
import CopilotHeader from '../common/CopilotHeader';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';
import { useCopilotConversation } from '../../../features/copilot-chat/hooks/useCopilotConversation';
import { Sidebar } from '../../../features/copilot-chat/components/Sidebar';

export function ChatView({ onOpenDashboard, onClose, context }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    messages,
    isProcessing,
    currentConversationId,
    sendMessage,
    stopProcessing,
    startNewConversation,
    selectConversation,
  } = useCopilotConversation(context);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden relative">
      {/* 1. Header do Chat: ☰  ⚡ Copilot Protheus  ✕ */}
      <CopilotHeader
        onToggleMenu={() => setIsSidebarOpen((prev) => !prev)}
        onClose={onClose}
        isConnected={true}
      />

      {/* Sidebar de Histórico (Off-canvas sobreposto quando aberto) */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-30 flex">
          <div className="w-64 h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] shadow-xl animate-fade-in z-40">
            <Sidebar
              currentConversationId={currentConversationId}
              onSelectConversation={(id) => {
                selectConversation(id);
                setIsSidebarOpen(false);
              }}
              onNewConversation={() => {
                startNewConversation();
                setIsSidebarOpen(false);
              }}
              context={context}
            />
          </div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-xs z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
        </div>
      )}

      {/* 2. Área Central de Mensagens: UserMessage / AssistantMessage */}
      <MessageList
        messages={messages}
        onOpenDashboard={onOpenDashboard}
        onSelectPrompt={sendMessage}
      />

      {/* 3. Rodapé Fixo: ChatComposer */}
      <ChatComposer
        onSend={sendMessage}
        onStop={stopProcessing}
        isProcessing={isProcessing}
        placeholder={messages.length > 0 ? 'Pergunte sobre estes dados...' : 'Pergunte ao Copilot...'}
      />
    </div>
  );
}

export default ChatView;

import React from 'react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotHeader } from './CopilotHeader';
import { QuickActions } from './QuickActions';
import { CopilotConversation } from './CopilotConversation';
import { PromptInput } from './PromptInput';

/**
 * Execution Sidebar (Fase 9)
 * Contém o chat, histórico de comandos e atalhos rápidos.
 */
export function CopilotSidebar() {
  const { chat } = useDashboardStore();

  if (!chat.isOpen) return null;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 z-10 relative">
      <CopilotHeader />
      
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-white to-transparent h-4 dark:from-slate-900 pointer-events-none" />
        
        {/* Scrollable Area para Conversa e Quick Actions */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <QuickActions />
          <div className="h-px w-full bg-slate-100 dark:bg-slate-800/60 mb-4" />
          <CopilotConversation />
        </div>
      </div>
      
      <PromptInput />
    </aside>
  );
}

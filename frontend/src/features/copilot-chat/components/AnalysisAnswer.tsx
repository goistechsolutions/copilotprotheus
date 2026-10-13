import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CopilotDashboardReference, OpenDashboardDetail } from '../types/chat.types';
import { DashboardCTA } from './DashboardCTA';

interface AnalysisAnswerProps {
  content: string;
  dashboard?: CopilotDashboardReference | null;
  conversationId?: string;
  messageId?: string;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
}

export function AnalysisAnswer({ 
  content, 
  dashboard, 
  conversationId = '', 
  messageId = '', 
  onOpenDashboard 
}: AnalysisAnswerProps) {
  const handleOpenDashboard = () => {
    if (!dashboard) return;
    if (onOpenDashboard) onOpenDashboard(dashboard);
    const detail: OpenDashboardDetail = {
      conversationId,
      messageId,
      dashboardId: dashboard.id || 'dash-active',
      dashboard,
    };
    window.dispatchEvent(new CustomEvent('copilot:open-dashboard', { detail }));
  };

  return (
    <div className="cprot-assistant-body flex flex-col w-full text-sm leading-relaxed text-[var(--cprot-text-main)]">
      {/* 1. Texto Executivo Natural (sem card pesado) */}
      <div className="cprot-message-markdown">
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-blue-500 underline" />,
            table: ({ node, ...props }) => <div className="cprot-markdown-table"><table {...props} /></div>,
            strong: ({ node, ...props }) => <strong {...props} className="font-bold text-[var(--cprot-text-main)]" />,
            p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />
          }}
        >
          {content || 'A análise foi concluída com sucesso.'}
        </ReactMarkdown>
      </div>

      {/* 2. DashboardCTA: Card destacado para abrir o modo Dashboard */}
      {dashboard && (
        <DashboardCTA
          dashboard={dashboard}
          onOpen={handleOpenDashboard}
        />
      )}
    </div>
  );
}

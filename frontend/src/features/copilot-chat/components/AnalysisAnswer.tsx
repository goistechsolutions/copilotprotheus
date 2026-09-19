import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CopilotDashboardReference, OpenDashboardDetail } from '../types/chat.types';
import { ArrowRightIcon, SparklesIcon } from './icons';

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

    if (onOpenDashboard) {
      onOpenDashboard(dashboard);
    }

    // Dispara evento padronizado de integração
    const detail: OpenDashboardDetail = {
      conversationId,
      messageId,
      dashboardId: dashboard.id || 'dash-active',
      dashboard,
    };
    window.dispatchEvent(new CustomEvent('copilot:open-dashboard', { detail }));
  };

  return (
    <article className="copilot-answer-card">
      <div className="copilot-answer-content">
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
            table: ({ node, ...props }) => <div className="copilot-markdown-table"><table {...props} /></div>,
          }}
        >
          {content || 'A análise foi concluída, mas não retornou um resumo textual.'}
        </ReactMarkdown>
      </div>
      {dashboard && (
        <div className="copilot-answer-action">
          <div>
            <span className="copilot-answer-action-eyebrow">Visão executiva pronta</span>
            <span className="copilot-answer-action-title">Explore os indicadores desta análise</span>
          </div>
          <button type="button" onClick={handleOpenDashboard} className="copilot-dashboard-button">
            <SparklesIcon size={15} />
            <span>Abrir dashboard</span>
            <ArrowRightIcon size={14} />
          </button>
        </div>
      )}
    </article>
  );
}

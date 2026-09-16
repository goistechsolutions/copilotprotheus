import React from 'react';
import { CopilotDashboardReference, OpenDashboardDetail } from '../types/chat.types';
import { ArrowRightIcon } from './icons';

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      fontSize: '15px',
      lineHeight: 1.6,
      color: 'var(--cprot-text-main)',
    }}>
      {/* Texto de Resumo Analítico Puro */}
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
      </div>

      {/* Link Discreto para Abrir Dashboard */}
      {dashboard && (
        <div style={{ marginTop: '6px' }}>
          <button
            type="button"
            onClick={handleOpenDashboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--cprot-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--cprot-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--cprot-primary)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>Abrir Dashboard</span>
            <ArrowRightIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

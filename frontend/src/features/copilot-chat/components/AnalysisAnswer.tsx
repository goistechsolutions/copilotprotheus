import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BarChart2, 
  ExternalLink, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { CopilotDashboardReference, OpenDashboardDetail } from '../types/chat.types';

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
  const [toastNotice, setToastNotice] = useState<string | null>(null);

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

  const routineAction = dashboard?.action_buttons?.find(b => b.type === 'routine' || b.routine);

  const handleOpenRoutine = () => {
    if (!routineAction?.routine) return;
    const routine = routineAction.routine;
    setToastNotice(`Abrindo rotina ${routine} no Protheus...`);
    window.dispatchEvent(new CustomEvent('protheus:open-routine', { detail: { routine } }));
    setTimeout(() => setToastNotice(null), 3500);
  };

  return (
    <article className="copilot-answer-card cprot-conversational-answer">
      {/* 1. Resposta Executiva Conversacional em Markdown */}
      <div className="copilot-answer-content">
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
            table: ({ node, ...props }) => <div className="cprot-markdown-table"><table {...props} /></div>,
          }}
        >
          {content || 'A análise foi concluída com sucesso.'}
        </ReactMarkdown>
      </div>

      {/* 2. Barra de Ação Secundária: Ver Dashboard sob Demanda */}
      {dashboard && (
        <div className="cprot-answer-action-bar">
          <button 
            type="button" 
            onClick={handleOpenDashboard} 
            className="cprot-btn-open-dashboard"
            title="Abrir painel visual completo com KPIs e gráficos"
          >
            <BarChart2 size={16} className="text-blue-400 shrink-0" />
            <span className="font-semibold">Abrir dashboard</span>
            <ArrowRight size={14} className="opacity-70 group-hover:opacity-100 transition-transform group-hover:translate-x-0.5" />
          </button>

          {routineAction && routineAction.routine && (
            <button 
              type="button" 
              onClick={handleOpenRoutine} 
              className="cprot-btn-secondary-routine"
              title={`Acessar rotina ${routineAction.routine} no Protheus`}
            >
              <ExternalLink size={13} className="shrink-0" />
              <span>{routineAction.label || `Abrir ${routineAction.routine}`}</span>
            </button>
          )}
        </div>
      )}

      {/* Notificação Toast */}
      {toastNotice && (
        <div className="cprot-toast-notice mx-4 mb-3">
          <CheckCircle2 size={13} />
          <span>{toastNotice}</span>
        </div>
      )}
    </article>
  );
}

import React from 'react';
import ReactMarkdown from 'react-markdown';
import DashboardCTA from './DashboardCTA';
import SuggestionChips from './SuggestionChips';

export function AssistantMessage({ 
  message, 
  onOpenDashboard, 
  onSelectSuggestion 
}) {
  const content = typeof message === 'string' ? message : message.content;
  const dashboard = message?.dashboard;
  const suggestions = message?.suggestions;
  const dashboardTitle = dashboard?.title || dashboard?.originPrompt || 'Faturamento por vendedor';

  return (
    <div className="flex flex-col items-start w-full mb-6 animate-fade-in">
      {/* Rótulo superior: ⚡ Copilot Protheus • 10:24 */}
      <div className="flex items-center gap-2 mb-2 select-none">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/15 text-blue-500 font-bold text-[10px]">
          ⚡
        </div>
        <span className="font-semibold text-xs text-[var(--color-text)]">
          Copilot Protheus
        </span>
        <span className="text-[10px] text-[var(--color-muted)] font-mono">
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Conteúdo Executivo Fluido (sem card pesado ao redor) */}
      <div className="text-sm leading-relaxed text-[var(--color-text)] max-w-full">
        <ReactMarkdown
          components={{
            strong: ({ node, ...props }) => <strong {...props} className="font-bold text-[var(--color-text)]" />,
            p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 mb-2 space-y-1" />,
            li: ({ node, ...props }) => <li {...props} className="text-xs sm:text-sm" />,
          }}
        >
          {content || 'A análise foi concluída com sucesso.'}
        </ReactMarkdown>
      </div>

      {/* CTA sob demanda: CHAT -> DASHBOARD */}
      {dashboard && (
        <DashboardCTA
          title={dashboardTitle}
          onClick={() => onOpenDashboard && onOpenDashboard(dashboard)}
        />
      )}

      {/* Pílulas de Sugestão de Continuidade */}
      {suggestions && suggestions.length > 0 && (
        <SuggestionChips
          suggestions={suggestions}
          onSelect={onSelectSuggestion}
        />
      )}
    </div>
  );
}

export default AssistantMessage;

import React from 'react'
export default function AssistantHeader({ context, onMinimize, onClose, onClear, minimized }) {
  const ctx = [context.environment, context.company, context.branch, context.module].filter(Boolean).join(' • ')
  return (
    <header className="widget-header">
      <div className="widget-header-info">
        <div className="widget-title">Copilot Protheus</div>
        {ctx && <div className="widget-subtitle">{ctx}</div>}
      </div>
      <div className="widget-header-actions">
        <button className="icon-btn" onClick={onClear} title="Limpar histórico">↺</button>
        <button className="icon-btn" onClick={onMinimize} title={minimized ? 'Expandir' : 'Minimizar'}>{minimized ? '▢' : '–'}</button>
        <button className="icon-btn" onClick={onClose} title="Fechar (Esc)">✕</button>
      </div>
    </header>
  )
}

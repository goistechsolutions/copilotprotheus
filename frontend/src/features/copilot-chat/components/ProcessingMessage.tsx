import React from 'react';
import { StopIcon } from './icons';

interface ProcessingMessageProps {
  onStop?: () => void;
  text?: string;
}

export function ProcessingMessage({ onStop, text = 'Consultando banco de dados Oracle...' }: ProcessingMessageProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: '20px',
    }} className="animate-fade-in">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: 'var(--cprot-primary)',
        fontWeight: 500,
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--cprot-primary)',
          animation: 'pulse 1.5s infinite',
        }} />
        <span>{text}</span>
      </div>

      {onStop && (
        <button
          type="button"
          onClick={onStop}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '4px 10px',
            fontSize: '11px',
            color: 'var(--cprot-text-muted)',
            background: 'transparent',
            border: '1px solid var(--cprot-border)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--cprot-danger)';
            e.currentTarget.style.borderColor = 'var(--cprot-danger)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--cprot-text-muted)';
            e.currentTarget.style.borderColor = 'var(--cprot-border)';
          }}
        >
          <StopIcon size={10} />
          <span>Interromper</span>
        </button>
      )}
    </div>
  );
}

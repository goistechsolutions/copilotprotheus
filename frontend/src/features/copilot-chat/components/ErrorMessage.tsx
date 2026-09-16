import React from 'react';
import { AlertCircleIcon } from './icons';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: '20px',
      color: 'var(--cprot-danger)',
    }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
        <AlertCircleIcon size={16} />
        <span>Não foi possível concluir a análise</span>
      </div>
      <p style={{
        fontSize: '13px',
        color: 'var(--cprot-text-sub)',
        margin: '6px 0 0 0',
        lineHeight: 1.4,
      }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '10px',
            background: 'transparent',
            border: '1px solid var(--cprot-border)',
            color: 'var(--cprot-text-main)',
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

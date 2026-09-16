import React from 'react';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelectSuggestion: (prompt: string) => void;
}

export function FollowUpSuggestions({ suggestions, onSelectSuggestion }: FollowUpSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div style={{
      marginTop: '20px',
      paddingTop: '16px',
      borderTop: '1px solid var(--cprot-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
    }} className="animate-fade-in">
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--cprot-text-muted)',
      }}>
        Continuar análise
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectSuggestion(suggestion)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 0',
              textAlign: 'left',
              fontSize: '14px',
              color: 'var(--cprot-text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'inherit',
              transition: 'color 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--cprot-primary)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--cprot-text-sub)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <span>•</span>
            <span>{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

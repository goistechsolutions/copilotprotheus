import React from 'react';
import { Sparkles } from 'lucide-react';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelectSuggestion: (prompt: string) => void;
}

export function FollowUpSuggestions({ suggestions, onSelectSuggestion }: FollowUpSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="cprot-suggestions-container animate-fade-in">
      <div className="cprot-suggestions-header">
        <Sparkles size={12} className="text-blue-500" />
        <span>Sugestões</span>
      </div>

      <div className="cprot-suggestions-pills">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectSuggestion(suggestion)}
            className="cprot-suggestion-pill"
            title={`Perguntar: ${suggestion}`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

import React from 'react';

export function SuggestionChips({ suggestions = [], onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-3.5 mb-2 w-full animate-fade-in select-none">
      <span className="text-[11px] font-semibold text-[var(--color-muted)]">
        Você também pode perguntar:
      </span>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect && onSelect(suggestion)}
            className="px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-medium transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5 active:scale-95"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SuggestionChips;

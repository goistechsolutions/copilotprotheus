import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function Accordion({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false, 
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3.5 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-[var(--color-muted)] shrink-0" />}
          <span>{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-[var(--color-muted)] shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-[var(--color-muted)] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="p-3.5 pt-0 border-t border-[var(--color-border)]/60 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export default Accordion;

import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div 
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;

import React from 'react';

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) {
  const base = "inline-flex items-center justify-center font-medium transition-all cursor-pointer rounded-xl select-none disabled:opacity-40 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-xs active:scale-[0.98]",
    secondary: "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-slate-100 dark:hover:bg-slate-800",
    ghost: "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5",
    outline: "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5",
  };

  const sizes = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-2 text-xs gap-2",
    lg: "px-4 py-2.5 text-sm gap-2.5",
    icon: "p-2 aspect-square",
  };

  return (
    <button 
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;

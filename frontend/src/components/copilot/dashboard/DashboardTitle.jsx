import React from 'react';

export function DashboardTitle({ title, subtitle }) {
  const currentMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  const capMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  return (
    <div className="mb-3 select-none">
      <h1 className="text-base font-bold text-[var(--color-text)] tracking-tight">
        {title || 'Faturamento por vendedor'}
      </h1>
      <p className="text-xs text-[var(--color-muted)] mt-0.5">
        {subtitle || `Mês atual • ${capMonth}`}
      </p>
    </div>
  );
}

export default DashboardTitle;

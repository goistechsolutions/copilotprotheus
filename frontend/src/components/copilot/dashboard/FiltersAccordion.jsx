import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export function FiltersAccordion({ filters = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  const displayFilters = filters && filters.length > 0 ? filters : [
    { label: 'Período', value: 'Outubro/2026' },
    { label: 'Vendedores', value: 'Todos' },
    { label: 'Filial', value: 'Todas' },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden my-2.5 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3.5 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none text-left"
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[var(--color-muted)] shrink-0" />
          <span>Filtros aplicados</span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-[var(--color-muted)] shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-[var(--color-muted)] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="p-3.5 pt-0 border-t border-[var(--color-border)]/60 space-y-2 animate-fade-in">
          {displayFilters.map((f, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[var(--color-border)]/40 last:border-0">
              <span className="text-[var(--color-muted)]">{f.label}</span>
              <span className="font-semibold text-[var(--color-text)]">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FiltersAccordion;

import React, { useState } from 'react';
import { Table, ChevronDown, ChevronUp, Download, CheckCircle2 } from 'lucide-react';

export function DetailsAccordion({ 
  rows = [], 
  columns = [],
  title = 'Detalhamento por vendedor' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState(false);

  // Fallback para visualização se rows estiver vazio
  const displayRows = rows && rows.length > 0 ? rows : [
    { Vendedor: '01', Faturamento: 'R$ 410.786,65', Qtd: '48' },
    { Vendedor: '02', Faturamento: 'R$ 165.420,00', Qtd: '22' },
    { Vendedor: '03', Faturamento: 'R$ 132.100,50', Qtd: '19' },
    { Vendedor: '04', Faturamento: 'R$ 98.400,00', Qtd: '15' },
    { Vendedor: '05', Faturamento: 'R$ 76.200,00', Qtd: '12' },
  ];

  const displayCols = columns && columns.length > 0 
    ? columns 
    : Object.keys(displayRows[0]);

  const handleExport = () => {
    const header = displayCols.join(';');
    const body = displayRows.map(r => displayCols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const csvContent = '\uFEFF' + header + '\r\n' + body;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `protheus_detalhes_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden my-2.5 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3.5 text-xs font-semibold text-[var(--color-text)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none text-left"
      >
        <div className="flex items-center gap-2">
          <Table size={14} className="text-[var(--color-muted)] shrink-0" />
          <span>{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-[var(--color-muted)] shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-[var(--color-muted)] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="p-3.5 pt-0 border-t border-[var(--color-border)]/60 space-y-2.5 animate-fade-in">
          <div className="max-h-48 overflow-auto border border-[var(--color-border)] rounded-lg">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[var(--color-muted)] sticky top-0 font-semibold uppercase">
                <tr>
                  {displayCols.map((col, idx) => (
                    <th key={idx} className="p-1.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {displayRows.slice(0, 15).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-blue-500/5">
                    {displayCols.map((col, cIdx) => (
                      <td key={cIdx} className="p-1.5 whitespace-nowrap text-[var(--color-text)]">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-600 border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] transition-colors cursor-pointer"
          >
            {exported ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Exportado com sucesso!</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Exportar para Excel (.csv)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default DetailsAccordion;

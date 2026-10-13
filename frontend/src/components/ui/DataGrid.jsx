import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateBR, isDateValue } from '../../utils/formatDate';

export function DataGrid({ data, columns, pagination = true, onRowClick }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  const totalPages = Math.ceil((data?.length || 0) / pageSize);
  const startIdx = page * pageSize;
  const currentData = data?.slice(startIdx, startIdx + pageSize) || [];

  const formatCell = (row, col) => {
    if (col.cell) {
      return col.cell({ getValue: () => row[col.accessorKey], row });
    }
    const val = row[col.accessorKey];
    if (val === null || val === undefined || val === '') return '—';

    // Se for data ou coluna temporal -> SEMPRE dd/mm/yyyy
    if (isDateValue(val, col.accessorKey || col.header)) {
      return formatDateBR(val);
    }

    // Se for coluna de valor/medida numérica -> formatação brasileira com 2 casas
    const colKey = String(col.accessorKey || col.header || '').toUpperCase();
    if (/VALOR|SALDO|TOTAL|VALBRUT|VALLIQ|PRECO|CUSTO|FATURAMENTO/i.test(colKey)) {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
      if (!isNaN(num)) {
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    return String(val);
  };

  return (
    <div className="flex flex-col w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-1)] shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[var(--surface-2)] text-xs uppercase font-semibold text-[var(--text-muted)] border-b border-[var(--border-default)]">
            <tr>
              {columns?.map((col, idx) => (
                <th key={idx} className="px-6 py-3.5 tracking-wider whitespace-nowrap">
                  {col.header || col.accessorKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {currentData.length > 0 ? (
              currentData.map((row, rowIdx) => (
                <tr 
                  key={rowIdx} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick 
                      ? 'cursor-pointer hover:bg-blue-500/10' 
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {columns?.map((col, colIdx) => (
                    <td key={colIdx} className="px-6 py-3 text-[var(--text-primary)] whitespace-nowrap">
                      {formatCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns?.length || 1} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border-default)] bg-[var(--surface-2)] px-6 py-3">
          <span className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-1.5 text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-1.5 text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

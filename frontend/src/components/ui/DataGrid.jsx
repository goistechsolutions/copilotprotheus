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
    <div className="flex flex-col w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {columns?.map((col, idx) => (
                <th key={idx} className="px-6 py-4 font-semibold tracking-wider whitespace-nowrap">
                  {col.header || col.accessorKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {currentData.length > 0 ? (
              currentData.map((row, rowIdx) => (
                <tr 
                  key={rowIdx} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick 
                      ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/20' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {columns?.map((col, colIdx) => (
                    <td key={colIdx} className="px-6 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns?.length || 1} className="px-6 py-12 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

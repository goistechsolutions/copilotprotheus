import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data, searchable = true, pageSize = 10 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = searchable
    ? data.filter(row =>
        Object.values(row).some(v =>
          String(v).toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-[#1E2535]">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8892A4]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar..."
              className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#8892A4] focus:outline-none focus:border-[#2196F3] transition-all"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E2535]">
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-[#8892A4] font-medium text-xs uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E2535]">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[#8892A4] text-sm">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr key={i} className="hover:bg-[#1E2535]/50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-[#F0F4FF]">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E2535]">
          <span className="text-[#8892A4] text-xs">
            {filtered.length} registros · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded text-[#8892A4] hover:text-white hover:bg-[#1E2535] disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded text-[#8892A4] hover:text-white hover:bg-[#1E2535] disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

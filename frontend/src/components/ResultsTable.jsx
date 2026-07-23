import React from 'react';
import { Table2 } from 'lucide-react';

export default function ResultsTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  const headers = Object.keys(rows[0] || {});
  if (headers.length === 0) return null;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-slate-700">Dados ({rows.length} registros)</h3>
        </div>
      </div>
      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {headers.map((h, idx) => (
                <th key={idx} className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-brand-50/50 transition-colors">
                {headers.map((h, j) => (
                  <td key={j} className="px-4 py-2.5 whitespace-nowrap text-[13px] text-slate-600 font-medium">
                    {row[h] !== null && row[h] !== undefined ? String(row[h]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

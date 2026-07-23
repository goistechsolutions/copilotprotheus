import React, { useState } from 'react';
import { Bot, Table2, ChevronDown, ChevronUp, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';

export default function ResponsePanel({ response }) {
  const [showTable, setShowTable] = useState(true);

  if (!response) return null;

  // Renderização de Erro
  if (response.error || response.status === 'error' || response.status === 'blocked') {
    return (
      <div className="w-full max-w-4xl mx-auto my-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex gap-4">
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
              {response.status === 'blocked' ? <ShieldAlert size={16} className="text-red-600" /> : <XCircle size={16} className="text-red-600" />}
            </div>
          </div>
          <div className="flex-1 bg-white rounded-2xl rounded-tl-none border border-red-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-semibold text-red-800 text-sm">{response.status === 'blocked' ? 'Ação Bloqueada' : 'Erro na Consulta'}</h3>
            </div>
            <div className="p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {response.summary || response.error || 'Ocorreu um erro ao processar sua solicitação.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasTable = response.table && Array.isArray(response.table) && response.table.length > 0;
  const headers = hasTable ? Object.keys(response.table[0]) : [];

  return (
    <div className="w-full max-w-4xl mx-auto my-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shadow-md">
            <Bot size={16} className="text-white" />
          </div>
        </div>
        <div className="flex-1 space-y-4">
          {/* Summary Box */}
          <div className="bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm p-5">
            <div className="prose prose-sm prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
              {response.summary || 'Aqui está o resultado da sua consulta.'}
            </div>
          </div>

          {/* Table Box */}
          {hasTable && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setShowTable(!showTable)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Table2 size={16} className="text-brand-600" />
                  Dados Retornados ({response.table.length} linhas)
                </div>
                {showTable ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              
              {showTable && (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {headers.map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {response.table.map((row, i) => (
                        <tr key={i} className="hover:bg-brand-50 transition-colors">
                          {headers.map((h, j) => (
                            <td key={j} className="px-6 py-3 whitespace-nowrap text-sm text-slate-600">
                              {row[h] !== null && row[h] !== undefined ? String(row[h]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

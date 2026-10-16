import React, { useState, useMemo } from 'react';
import { Table, ChevronDown, ChevronUp, Download, CheckCircle2, Search, Medal } from 'lucide-react';

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export function DetailsAccordion({ 
  rows = [], 
  columns = [],
  title = 'Detalhamento por vendedor' 
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [exported, setExported] = useState(false);

  // Fallback para visualização se rows estiver vazio
  const displayRows = useMemo(() => {
    if (rows && rows.length > 0) return rows;
    return [
      { COD_VENDEDOR: '01', VENDEDOR: 'Carlos Alberto', VALOR_TOTAL: 651.00, QTD_PEDIDOS: 48 },
      { COD_VENDEDOR: '15', VENDEDOR: 'Mariana Silva', VALOR_TOTAL: 215.00, QTD_PEDIDOS: 22 },
      { COD_VENDEDOR: '03', VENDEDOR: 'Lucas Oliveira', VALOR_TOTAL: 180.00, QTD_PEDIDOS: 19 },
      { COD_VENDEDOR: '08', VENDEDOR: 'Renata Costa', VALOR_TOTAL: 160.00, QTD_PEDIDOS: 15 },
      { COD_VENDEDOR: '12', VENDEDOR: 'Felipe Santos', VALOR_TOTAL: 120.00, QTD_PEDIDOS: 12 },
    ];
  }, [rows]);

  const displayCols = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    return Object.keys(displayRows[0] || {});
  }, [columns, displayRows]);

  // Identifica a coluna numérica principal de valor para ordenação e barra de progresso
  const valCol = useMemo(() => {
    return displayCols.find(c => /VALOR|TOTAL|FATUR|SALDO|RECEITA/i.test(c)) || displayCols[displayCols.length - 1];
  }, [displayCols]);

  const totalSum = useMemo(() => {
    return displayRows.reduce((acc, r) => {
      const v = typeof r[valCol] === 'number' ? r[valCol] : parseFloat(String(r[valCol] || '').replace(/[^0-9.-]+/g, ''));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [displayRows, valCol]);

  // Filtra por termo de busca
  const filteredRows = useMemo(() => {
    if (!searchTerm) return displayRows;
    const term = searchTerm.toLowerCase();
    return displayRows.filter(r => 
      displayCols.some(c => String(r[c] || '').toLowerCase().includes(term))
    );
  }, [displayRows, displayCols, searchTerm]);

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

  const getRankBadge = (index) => {
    if (index === 0) return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 font-bold text-[9px]">1º</span>;
    if (index === 1) return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-400/20 text-slate-300 font-bold text-[9px]">2º</span>;
    if (index === 2) return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-700/20 text-amber-600 font-bold text-[9px]">3º</span>;
    return <span className="text-[9px] text-[var(--color-muted)] font-mono">{index + 1}º</span>;
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden my-2.5 shadow-xs transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-xs font-bold text-[var(--color-text)] hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none text-left"
      >
        <div className="flex items-center gap-2">
          <Table size={15} className="text-blue-500 shrink-0" />
          <span>{title} ({displayRows.length} registros)</span>
        </div>
        {isOpen ? (
          <ChevronUp size={15} className="text-[var(--color-muted)] shrink-0" />
        ) : (
          <ChevronDown size={15} className="text-[var(--color-muted)] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-[var(--color-border)]/60 space-y-3 animate-fade-in">
          {/* Barra de Filtro Rápido e Botão de Exportar */}
          <div className="flex items-center gap-2 pt-3">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="text"
                placeholder="Filtrar dados da tabela..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] outline-hidden focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleExport}
              title="Exportar dados para Excel (.csv)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-500 border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer shrink-0"
            >
              {exported ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span className="hidden sm:inline">Exportado</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span className="hidden sm:inline">Excel</span>
                </>
              )}
            </button>
          </div>

          {/* Tabela Formatada */}
          <div className="max-h-56 overflow-auto border border-[var(--color-border)] rounded-xl scrollbar-thin">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-[var(--color-muted)] sticky top-0 font-bold uppercase text-[9px] tracking-wider z-10 backdrop-blur-xs">
                <tr>
                  <th className="p-2 w-8 text-center">#</th>
                  {displayCols.map((col, idx) => {
                    const isCurrency = /VALOR|TOTAL|FATUR|SALDO|RECEITA/i.test(col);
                    return (
                      <th key={idx} className={`p-2 whitespace-nowrap ${isCurrency ? 'text-right' : 'text-left'}`}>
                        {col.replace(/_/g, ' ')}
                      </th>
                    );
                  })}
                  <th className="p-2 w-20 text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50 text-[11px]">
                {filteredRows.slice(0, 20).map((row, rIdx) => {
                  const rawVal = typeof row[valCol] === 'number' ? row[valCol] : parseFloat(String(row[valCol] || '').replace(/[^0-9.-]+/g, ''));
                  const numVal = isNaN(rawVal) ? 0 : rawVal;
                  const pct = totalSum > 0 ? ((numVal / totalSum) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={rIdx} className="hover:bg-blue-500/5 transition-colors">
                      <td className="p-2 text-center whitespace-nowrap">
                        {getRankBadge(rIdx)}
                      </td>
                      {displayCols.map((col, cIdx) => {
                        const val = row[col];
                        const isCurrency = /VALOR|TOTAL|FATUR|SALDO|RECEITA/i.test(col);
                        const isNumber = typeof val === 'number' || (!isNaN(val) && val !== '' && !isNaN(parseFloat(val)));

                        return (
                          <td 
                            key={cIdx} 
                            className={`p-2 whitespace-nowrap text-[var(--color-text)] ${isCurrency ? 'text-right font-semibold font-mono' : isNumber ? 'text-right font-mono' : 'text-left'}`}
                          >
                            {isCurrency ? formatCurrency(val) : String(val ?? '')}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-10 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${rIdx === 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                              style={{ width: `${Math.min(100, Math.max(5, parseFloat(pct)))}%` }} 
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--color-muted)] w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailsAccordion;

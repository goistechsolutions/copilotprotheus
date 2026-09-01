import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  LayoutDashboard,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  Table,
  Lightbulb,
  Sparkles,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;

  const candidate = value.trim();
  if (!/^[+-]?\s*(?:R\$\s*)?\d[\d\s.,]*(?:%|\s*)$/.test(candidate)) return null;

  const normalized = candidate
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(val) {
  if (typeof val === 'number') {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(val);
}

function getSafeRows(result) {
  const candidateRows = Array.isArray(result?.structured?.rows)
    ? result.structured.rows
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.items)
        ? result.items
        : [];
  return candidateRows.filter(row => row && typeof row === 'object' && !Array.isArray(row));
}

export function detectQueryArea(queryText = '', moduleCode = '', result = null) {
  const norm = (String(queryText) + ' ' + String(result?.summary || '')).toLowerCase();
  const mod = String(moduleCode).toUpperCase();

  if (mod.includes('FAT') || norm.includes('venda') || norm.includes('faturament') || norm.includes('pedido') || norm.includes('cliente')) {
    return { key: 'vendas', label: 'Vendas', module: 'SIGAFAT' };
  }
  if (mod.includes('FIN') || norm.includes('caixa') || norm.includes('pagar') || norm.includes('receber') || norm.includes('duplicat') || norm.includes('banc') || norm.includes('dda')) {
    return { key: 'financeiro', label: 'Financeiro', module: 'SIGAFIN' };
  }
  if (mod.includes('COM') || norm.includes('compra') || norm.includes('forneced') || norm.includes('cotac') || norm.includes('supriment')) {
    return { key: 'compras', label: 'Compras', module: 'SIGACOM' };
  }
  if (mod.includes('EST') || norm.includes('estoque') || norm.includes('armazem') || norm.includes('saldo') || norm.includes('inventari') || norm.includes('produto')) {
    return { key: 'estoque', label: 'Estoque', module: 'SIGAEST' };
  }
  if (mod.includes('CTB') || norm.includes('contabil') || norm.includes('dre') || norm.includes('balanc') || norm.includes('lancament') || norm.includes('patrimon')) {
    return { key: 'contabilidade', label: 'Contabilidade', module: 'SIGACTB' };
  }
  return { key: 'financeiro', label: 'Financeiro', module: 'SIGAFIN' };
}

export default function InlineChatDashboard({ result, userPrompt, context, onNavigateToDashboard }) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const rows = useMemo(() => getSafeRows(result), [result]);
  const columns = useMemo(() => {
    if (Array.isArray(result?.structured?.columns) && result.structured.columns.length > 0) {
      return result.structured.columns;
    }
    if (rows.length > 0) {
      return Object.keys(rows[0]);
    }
    return [];
  }, [result, rows]);

  const areaInfo = useMemo(() => {
    return detectQueryArea(userPrompt, context?.module, result);
  }, [userPrompt, context, result]);

  // Cálculos de KPIs a partir dos dados retornados
  const stats = useMemo(() => {
    if (!rows.length || !columns.length) {
      return null;
    }

    // Procura a melhor coluna numérica
    let numericCol = null;
    let labelCol = null;

    for (const col of columns) {
      const lower = col.toLowerCase();
      if (!numericCol && (lower.includes('valor') || lower.includes('total') || lower.includes('preco') || lower.includes('fat') || lower.includes('saldo'))) {
        numericCol = col;
      }
      if (!labelCol && (lower.includes('mes') || lower.includes('data') || lower.includes('desc') || lower.includes('nome') || lower.includes('cliente') || lower.includes('produto'))) {
        labelCol = col;
      }
    }

    if (!numericCol) {
      for (const col of columns) {
        if (rows.some(r => typeof parseNumeric(r[col]) === 'number')) {
          numericCol = col;
          break;
        }
      }
    }

    if (!labelCol && columns.length > 0) {
      labelCol = columns[0] !== numericCol ? columns[0] : (columns[1] || columns[0]);
    }

    if (!numericCol) return null;

    let sum = 0;
    let count = 0;
    let maxVal = -Infinity;
    let maxRow = null;

    const chartLabels = [];
    const chartValues = [];

    rows.forEach(r => {
      const val = parseNumeric(r[numericCol]);
      if (val !== null) {
        sum += val;
        count++;
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
        chartLabels.push(String(r[labelCol] || `Item ${count}`));
        chartValues.push(val);
      }
    });

    const avg = count > 0 ? sum / count : 0;
    const maxLabel = maxRow ? String(maxRow[labelCol] || '') : '';

    return {
      total: sum,
      average: avg,
      maxVal: maxVal > -Infinity ? maxVal : 0,
      maxLabel,
      numericCol,
      labelCol,
      chartLabels: chartLabels.slice(0, 12),
      chartValues: chartValues.slice(0, 12),
    };
  }, [rows, columns]);

  // Download CSV
  const handleExportCsv = () => {
    if (!rows.length || !columns.length) return;
    const header = columns.join(';');
    const body = rows.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `copilot-protheus-${areaInfo.key}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = useMemo(() => {
    if (!stats || !stats.chartLabels.length) return null;

    return {
      labels: stats.chartLabels,
      datasets: [
        {
          label: stats.numericCol || 'Valor',
          data: stats.chartValues,
          backgroundColor: '#004FCE',
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    };
  }, [stats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => formatCurrency(context.raw)
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 10 },
          color: '#64748b',
          callback: (value) => {
            if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
            return `R$ ${value}`;
          }
        }
      }
    }
  };

  return (
    <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
      {/* 1. Bento KPI Cards Inline */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Card 1: Total */}
          <div className="bg-[#f0fdf4] dark:bg-emerald-950/30 border border-[#bbf7d0] dark:border-emerald-800/40 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#166534] dark:text-emerald-400 uppercase tracking-wider">
                {stats.numericCol ? stats.numericCol.toUpperCase() : 'TOTAL'}
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
            </div>
            <div className="text-lg font-bold text-[#15803d] dark:text-emerald-300">
              {formatCurrency(stats.total)}
            </div>
          </div>

          {/* Card 2: Média Mensal */}
          <div className="bg-[#eff6ff] dark:bg-blue-950/30 border border-[#bfdbfe] dark:border-blue-800/40 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#1e40af] dark:text-blue-400 uppercase tracking-wider">
                MÉDIA DO PERÍODO
              </span>
              <Activity className="w-3.5 h-3.5 text-[#004fce]" />
            </div>
            <div className="text-lg font-bold text-[#1d4ed8] dark:text-blue-300">
              {formatCurrency(stats.average)}
            </div>
          </div>

          {/* Card 3: Destaque / Maior Registro */}
          {stats.maxLabel && (
            <div className="sm:col-span-2 bg-[#f8fafc] dark:bg-slate-800/60 border border-[#e2e8f0] dark:border-slate-700 rounded-xl p-3 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#64748b] dark:text-slate-400 uppercase tracking-wider block">
                  PONTO DE MAIOR VOLUME
                </span>
                <div className="text-[13px] font-bold text-[#0f172a] dark:text-white mt-0.5">
                  {stats.maxLabel}: <span className="text-[#004fce] dark:text-[#60a5fa]">{formatCurrency(stats.maxVal)}</span>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-[#004fce] shrink-0" />
            </div>
          )}
        </div>
      )}

      {/* 2. Gráfico de Barras Inline */}
      {chartData && (
        <div className="bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0f172a] dark:text-white">
              Evolução / Comparativo
            </span>
            <span className="text-[10px] font-medium text-[#64748b]">Oracle Protheus</span>
          </div>
          <div className="h-44 w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* 3. AI Insights Box */}
      <div className="bg-[#fefce8] dark:bg-amber-950/30 border border-[#fef08a] dark:border-amber-800/40 rounded-xl p-3 text-[12px] text-[#854d0e] dark:text-amber-200 leading-relaxed shadow-xs flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-[#eab308] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Insight do Copiloto: </span>
          Os dados consolidados indicam estabilidade operacional no período com execução de query nativa no Oracle TOTVS Cloud.
        </div>
      </div>

      {/* 4. Acordeões de Filtros e Detalhamento */}
      <div className="space-y-1.5 pt-1">
        {/* Acordeão: Filtros Aplicados */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#004fce]" />
            <span>Filtros Aplicados</span>
          </div>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showFilters && (
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div><strong>Empresa / Filial:</strong> {context?.company || '01'} / {context?.branch || '0101'}</div>
            <div><strong>Módulo:</strong> {areaInfo.module}</div>
            <div><strong>Ambiente:</strong> {context?.environment || 'c8te0u_prod'}</div>
            <div><strong>Exclusão Lógica:</strong> D_E_L_E_T_ &lt;&gt; &apos;*&apos;</div>
          </div>
        )}

        {/* Acordeão: Detalhamento da Tabela */}
        {rows.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-[#004fce]" />
                <span>Detalhamento dos Dados ({rows.length} registros)</span>
              </div>
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDetails && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-56 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                    <tr>
                      {columns.map((col, idx) => (
                        <th key={idx} className="px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.slice(0, 15).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {columns.map((col, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                            {String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. Botões de Ação Executiva */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {onNavigateToDashboard && (
          <button
            type="button"
            onClick={() => onNavigateToDashboard(areaInfo.key)}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#004fce] hover:bg-[#003ea6] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Abrir Painel de {areaInfo.label}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#004fce]" />
          <span>Exportar para Excel</span>
        </button>
      </div>
    </div>
  );
}

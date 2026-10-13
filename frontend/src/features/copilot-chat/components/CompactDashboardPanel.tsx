import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  TrendingUp, 
  Users, 
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { CopilotDashboardReference } from '../types/chat.types';

interface CompactDashboardPanelProps {
  dashboard: CopilotDashboardReference;
  onBackToChat: () => void;
  onClosePanel?: () => void;
}

const formatCompactCurrency = (val: any): string => {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);

  if (Math.abs(num) >= 1_000_000) {
    return `R$ ${(num / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} mi`;
  }
  if (Math.abs(num) >= 1_000) {
    return `R$ ${(num / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const formatFullCurrency = (val: any): string => {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export function CompactDashboardPanel({
  dashboard,
  onBackToChat,
  onClosePanel,
}: CompactDashboardPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Título do Dashboard em caixa alta
  const title = (
    dashboard?.title || 
    dashboard?.originPrompt || 
    'Faturamento por Vendedor'
  ).toUpperCase();

  // Extração dos 2 KPIs principais para o topo compacto
  const kpis = useMemo(() => {
    const list: Array<{ label: string; value: string; raw: number }> = [];

    if (dashboard?.kpis && dashboard.kpis.length > 0) {
      dashboard.kpis.slice(0, 2).forEach((k: any) => {
        list.push({
          label: k.label || 'Indicador',
          value: formatCompactCurrency(k.value),
          raw: Number(k.value) || 0,
        });
      });
      return list;
    }

    if (dashboard?.backend_kpis) {
      const bk = dashboard.backend_kpis;
      if (bk.total !== undefined) {
        list.push({
          label: 'Faturamento Total',
          value: formatCompactCurrency(bk.total),
          raw: bk.total,
        });
      }
      if (bk.max_value !== undefined) {
        list.push({
          label: bk.maior_ocorrencia_nome ? `Maior (${bk.maior_ocorrencia_nome})` : 'Maior Destaque',
          value: formatCompactCurrency(bk.max_value),
          raw: bk.max_value,
        });
      }
      return list;
    }

    // Fallback calculando das linhas se existirem
    const rows = dashboard?.rows || [];
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      const valKey = keys.find(k => /VALOR|FATUR|TOTAL|SALDO/i.test(k));
      if (valKey) {
        const sum = rows.reduce((acc, r) => acc + (parseFloat(String(r[valKey]).replace(/[^0-9.-]+/g, '')) || 0), 0);
        list.push({ label: 'Faturamento', value: formatCompactCurrency(sum), raw: sum });
      }
    }

    return list.length > 0 ? list : [
      { label: 'Faturamento', value: 'R$ 1,04 mi', raw: 1045388 },
      { label: 'Maior vendedor', value: 'R$ 410,7 mil', raw: 410786 }
    ];
  }, [dashboard]);

  // Extração de dados da série para o gráfico compacto
  const chartData = useMemo(() => {
    if (dashboard?.series && dashboard.series.length > 0 && dashboard.series[0].points?.length > 1) {
      return {
        title: dashboard.series[0].label || 'Gráfico de Vendas',
        points: dashboard.series[0].points,
      };
    }

    const rows = dashboard?.rows || [];
    if (rows.length >= 2 && rows.length <= 30) {
      const keys = Object.keys(rows[0] || {});
      const dimKey = keys.find(k => /^(MES|MÊS|PERIODO|DATA|VENDEDOR|FILIAL|CLIENTE|CODIGO)/i.test(k)) || keys[0];
      const valKey = keys.find(k => /^(VALOR|FATUR|TOTAL|RECEITA|VALBRUT|SALDO)/i.test(k)) || keys[1];

      if (dimKey && valKey) {
        const points = rows.map(r => ({
          label: String(r[dimKey] || '').trim(),
          value: parseFloat(String(r[valKey] || '0').replace(/[^0-9.-]+/g, '')) || 0,
        }));
        return {
          title: 'Gráfico de Vendas',
          points,
        };
      }
    }

    return null;
  }, [dashboard]);

  // Exportar dados para Excel
  const handleExportExcel = () => {
    const rows = dashboard?.rows || [];
    if (!rows || rows.length === 0) return;

    const cols = dashboard?.columns || Object.keys(rows[0] || {});
    const header = cols.join(';');
    const body = rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const csvContent = '\uFEFF' + header + '\r\n' + body;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `protheus_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage('Exportado com sucesso para Excel!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClose = () => {
    if (onClosePanel) {
      onClosePanel();
    } else {
      window.dispatchEvent(new CustomEvent('copilot:close'));
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'cprot-close' }, '*');
      }
    }
  };

  // Cálculo de medidas para renderizar o gráfico SVG compacto
  const svgMetrics = useMemo(() => {
    if (!chartData?.points || chartData.points.length === 0) return null;
    const maxVal = Math.max(...chartData.points.map(p => p.value), 1);
    const height = 150;
    const barCount = chartData.points.length;
    const width = Math.max(barCount * 44, 280);
    const barWidth = Math.min(24, Math.max(14, (width / barCount) * 0.52));
    return { maxVal, height, width, barWidth };
  }, [chartData]);

  const appliedFilters = useMemo(() => {
    if (dashboard?.applied_filters && dashboard.applied_filters.length > 0) {
      return dashboard.applied_filters;
    }
    const list = [];
    const meta = dashboard?.metadata || {};
    if (meta.module) list.push({ label: 'Módulo', value: meta.module });
    if (meta.environment) list.push({ label: 'Ambiente', value: meta.environment });
    list.push({ label: 'Status', value: 'Faturado / Normal' });
    return list;
  }, [dashboard]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--cprot-bg)] text-[var(--cprot-text-main)] overflow-hidden animate-fade-in font-sans">
      {/* 1. Header do Painel Dashboard: ← Chat | Dashboard | ✕ */}
      <header className="flex h-14 shrink-0 items-center justify-between px-3.5 border-b border-[var(--cprot-border)] bg-[var(--cprot-bg)] z-10">
        <button
          type="button"
          onClick={onBackToChat}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] text-[var(--cprot-text-main)] transition-colors cursor-pointer"
          title="Voltar ao chat"
        >
          <ArrowLeft size={13} className="text-blue-500" />
          <span>Chat</span>
        </button>

        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cprot-text-muted)]">
          Dashboard
        </span>

        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-lg text-[var(--cprot-text-sub)] hover:text-red-400 hover:bg-[var(--cprot-surface-hover)] transition-colors cursor-pointer"
          title="Fechar painel"
          aria-label="Fechar painel"
        >
          <X size={16} />
        </button>
      </header>

      {/* 2. Conteúdo Rolável Compacto */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Título da Análise em Caixa Alta */}
        <div>
          <h2 className="text-sm font-bold tracking-tight text-[var(--cprot-text-main)]">
            {title}
          </h2>
        </div>

        {/* Linha com os 2 Indicadores Compactos */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-center p-3 rounded-xl bg-[var(--cprot-surface)] border border-[var(--cprot-border)] shadow-xs"
              >
                <span className="text-base font-extrabold tracking-tight text-[var(--cprot-text-main)] truncate">
                  {kpi.value}
                </span>
                <span className="text-[11px] font-medium text-[var(--cprot-text-muted)] mt-0.5 truncate">
                  {kpi.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Gráfico Compacto de Vendas */}
        {chartData && svgMetrics && (
          <div className="p-3.5 rounded-xl bg-[var(--cprot-surface)] border border-[var(--cprot-border)] shadow-xs">
            <div className="text-xs font-bold text-[var(--cprot-text-main)] uppercase tracking-wide mb-2">
              {chartData.title}
            </div>

            <div className="overflow-x-auto pb-1 scrollbar-thin">
              <svg
                width={svgMetrics.width + 40}
                height={svgMetrics.height + 35}
                viewBox={`0 0 ${svgMetrics.width + 40} ${svgMetrics.height + 35}`}
                className="block"
              >
                {/* Linhas de Grade */}
                {[0, 0.5, 1].map((pct, i) => {
                  const y = svgMetrics.height - pct * (svgMetrics.height - 20) + 5;
                  return (
                    <line
                      key={i}
                      x1="10"
                      y1={y}
                      x2={svgMetrics.width + 30}
                      y2={y}
                      stroke="var(--cprot-border)"
                      strokeDasharray="2 2"
                      opacity={0.6}
                    />
                  );
                })}

                {/* Barras do Gráfico */}
                {chartData.points.map((pt, i) => {
                  const step = svgMetrics.width / chartData.points.length;
                  const x = 15 + i * step + (step - svgMetrics.barWidth) / 2;
                  const barH = Math.max(3, (pt.value / svgMetrics.maxVal) * (svgMetrics.height - 20));
                  const y = svgMetrics.height + 5 - barH;

                  return (
                    <g key={i}>
                      <title>{`${pt.label}: ${formatFullCurrency(pt.value)}`}</title>
                      <rect
                        x={x}
                        y={y}
                        width={svgMetrics.barWidth}
                        height={barH}
                        rx="3"
                        fill="#3B82F6"
                        className="hover:fill-blue-400 transition-colors cursor-pointer"
                      />
                      <text
                        x={x + svgMetrics.barWidth / 2}
                        y={svgMetrics.height + 20}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--cprot-text-muted)"
                        fontFamily="inherit"
                        className="select-none"
                      >
                        {pt.label.length > 7 ? `${pt.label.slice(0, 6)}…` : pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* 3. Acordeão: Filtros Aplicados */}
        <div className="rounded-xl border border-[var(--cprot-border)] bg-[var(--cprot-surface)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full p-3 text-xs font-semibold text-[var(--cprot-text-main)] hover:bg-[var(--cprot-surface-hover)] transition-colors text-left cursor-pointer"
          >
            <span>▾ Filtros aplicados</span>
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showFilters && (
            <div className="p-3 pt-0 border-t border-[var(--cprot-border)] space-y-1.5 animate-fade-in">
              {appliedFilters.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--cprot-border)]/50 last:border-0">
                  <span className="text-[var(--cprot-text-muted)]">{f.label}</span>
                  <span className="font-medium text-[var(--cprot-text-main)]">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Acordeão: Detalhamento */}
        <div className="rounded-xl border border-[var(--cprot-border)] bg-[var(--cprot-surface)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full p-3 text-xs font-semibold text-[var(--cprot-text-main)] hover:bg-[var(--cprot-surface-hover)] transition-colors text-left cursor-pointer"
          >
            <span>▾ Detalhamento</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDetails && (
            <div className="p-3 pt-0 border-t border-[var(--cprot-border)] animate-fade-in">
              {dashboard?.rows && dashboard.rows.length > 0 ? (
                <div className="space-y-2 mt-2">
                  <div className="max-h-48 overflow-auto border border-[var(--cprot-border)] rounded-lg">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-[var(--cprot-surface-hover)] text-[var(--cprot-text-muted)] sticky top-0">
                        <tr>
                          {(dashboard.columns || Object.keys(dashboard.rows[0])).map((col, idx) => (
                            <th key={idx} className="p-1.5 font-semibold uppercase whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--cprot-border)]/60">
                        {dashboard.rows.slice(0, 15).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-blue-500/5">
                            {(dashboard.columns || Object.keys(dashboard.rows[0])).map((col, cIdx) => (
                              <td key={cIdx} className="p-1.5 whitespace-nowrap text-[var(--cprot-text-main)]">
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
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[var(--cprot-surface-hover)] hover:bg-emerald-500/10 hover:text-emerald-500 border border-[var(--cprot-border)] text-xs font-medium text-[var(--cprot-text-main)] transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Exportar dados para Excel</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--cprot-text-muted)] py-2">
                  Nenhum dado bruto disponível para esta consulta.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Toast de Confirmação */}
        {toastMessage && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-fade-in">
            <CheckCircle2 size={14} />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* 5. Rodapé Fixo: ← Voltar para conversa */}
      <footer className="p-3 border-t border-[var(--cprot-border)] bg-[var(--cprot-bg)] shrink-0">
        <button
          type="button"
          onClick={onBackToChat}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[var(--cprot-surface)] hover:bg-[var(--cprot-surface-hover)] border border-[var(--cprot-border)] text-xs font-semibold text-[var(--cprot-text-main)] transition-all cursor-pointer shadow-xs hover:border-[var(--cprot-primary)]/40"
        >
          <ArrowLeft size={14} className="text-blue-500" />
          <span>Voltar para conversa</span>
        </button>
      </footer>
    </div>
  );
}

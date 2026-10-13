import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  TrendingUp, 
  BarChart2, 
  Filter, 
  Table as TableIcon, 
  Download, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  Sparkles, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { CopilotDashboardReference, OpenDashboardDetail } from '../types/chat.types';

interface AnalysisAnswerProps {
  content: string;
  dashboard?: CopilotDashboardReference | null;
  conversationId?: string;
  messageId?: string;
  onOpenDashboard?: (dashboard: CopilotDashboardReference) => void;
}

const formatCurrency = (val: any): string => {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const formatNumber = (val: any): string => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pt-BR').format(num);
};

const formatKpiDisplay = (kpi: any): { label: string; value: string; isGreen: boolean } => {
  const label = (kpi.label || '').toUpperCase();
  const rawVal = kpi.value;
  const isGreen = kpi.tone === 'positive' || label.includes('TOTAL') || label.includes('MAIOR');

  if (kpi.highlight_text) {
    const formattedNum = typeof rawVal === 'number' ? formatCurrency(rawVal) : rawVal;
    return {
      label,
      value: `${kpi.highlight_text} (${formattedNum})`,
      isGreen: true,
    };
  }

  const isCurrency = kpi.format === 'currency' || label.includes('FATUR') || label.includes('VALOR') || label.includes('TICKET');
  const formattedVal = isCurrency ? formatCurrency(rawVal) : formatNumber(rawVal);
  return { label, value: formattedVal, isGreen };
};

export function AnalysisAnswer({ 
  content, 
  dashboard, 
  conversationId = '', 
  messageId = '', 
  onOpenDashboard 
}: AnalysisAnswerProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Extração ou inferência dos KPIs executivos
  const kpiList = useMemo(() => {
    if (dashboard?.kpis && dashboard.kpis.length > 0) {
      return dashboard.kpis.map(formatKpiDisplay);
    }
    if (dashboard?.backend_kpis) {
      const bk = dashboard.backend_kpis;
      const list = [];
      if (bk.total !== undefined) {
        list.push({ label: 'FATURAMENTO TOTAL', value: formatCurrency(bk.total), isGreen: true });
      }
      if (bk.average !== undefined) {
        list.push({ label: 'FATURAMENTO MÉDIO', value: formatCurrency(bk.average), isGreen: false });
      }
      if (bk.maior_ocorrencia_nome && bk.max_value !== undefined) {
        list.push({
          label: 'MAIOR DESTAQUE',
          value: `${bk.maior_ocorrencia_nome} (${formatCurrency(bk.max_value)})`,
          isGreen: true,
        });
      }
      return list;
    }
    return [];
  }, [dashboard]);

  // Extração ou inferência dos pontos de série para o gráfico
  const chartData = useMemo(() => {
    if (dashboard?.series && dashboard.series.length > 0 && dashboard.series[0].points?.length > 1) {
      return {
        title: dashboard.series[0].label ? `${dashboard.series[0].label} - Ano 2026` : 'Faturamento Mensal - Ano 2026',
        legend: 'Faturamento Bruto',
        points: dashboard.series[0].points,
      };
    }
    const rows = dashboard?.rows || [];
    if (rows.length >= 2 && rows.length <= 25) {
      const keys = Object.keys(rows[0] || {});
      const dimKey = keys.find(k => /^(MES|MÊS|PERIODO|DATA|ANO_MES|VENDEDOR|FILIAL|CLIENTE)/i.test(k));
      const valKey = keys.find(k => /^(VALOR|FATUR|TOTAL|RECEITA|VALBRUT)/i.test(k));
      if (dimKey && valKey) {
        const points = rows.map(r => ({
          label: String(r[dimKey] || '').trim(),
          value: parseFloat(String(r[valKey] || '0').replace(/[^0-9.-]+/g, '')) || 0,
        }));
        return {
          title: 'Faturamento Mensal - Ano 2026',
          legend: 'Faturamento Bruto',
          points,
        };
      }
    }
    return null;
  }, [dashboard]);

  // Insights qualitativos
  const insightText = useMemo(() => {
    if (dashboard?.backend_insights && dashboard.backend_insights.length > 0) {
      const top = dashboard.backend_insights[0];
      return top.description || top.title || null;
    }
    if (dashboard?.insights && dashboard.insights.length > 0) {
      const first = dashboard.insights[0];
      return typeof first === 'string' ? first : (first?.description || first?.title || null);
    }
    return null;
  }, [dashboard]);

  // Filtros aplicados
  const appliedFilters = useMemo(() => {
    if (dashboard?.applied_filters && dashboard.applied_filters.length > 0) {
      return dashboard.applied_filters;
    }
    const filters: Array<{ label: string; value: string }> = [];
    const meta = dashboard?.metadata || {};
    if (meta.module) filters.push({ label: 'Módulo', value: meta.module });
    if (meta.environment) filters.push({ label: 'Ambiente', value: meta.environment });
    filters.push({ label: 'Status', value: 'Faturado / Normal' });
    return filters;
  }, [dashboard]);

  // Rotinas Protheus / Ações Rápidas
  const routineAction = useMemo(() => {
    if (dashboard?.action_buttons && dashboard.action_buttons.length > 0) {
      const routineBtn = dashboard.action_buttons.find(b => b.type === 'routine' || b.routine);
      if (routineBtn) return routineBtn;
    }
    return { label: 'Abrir Relatório de Vendas (MATA410)', routine: 'MATA410' };
  }, [dashboard]);

  // Exportação nativa para Excel (.xlsx / .csv compatível)
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
    link.download = `relatorio_protheus_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('Relatório exportado com sucesso!');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleOpenDashboard = () => {
    if (!dashboard) return;
    if (onOpenDashboard) onOpenDashboard(dashboard);
    const detail: OpenDashboardDetail = {
      conversationId,
      messageId,
      dashboardId: dashboard.id || 'dash-active',
      dashboard,
    };
    window.dispatchEvent(new CustomEvent('copilot:open-dashboard', { detail }));
  };

  const handleOpenRoutine = () => {
    const routine = routineAction.routine || 'MATA410';
    setExportNotice(`Abrindo rotina ${routine} no Protheus...`);
    window.dispatchEvent(new CustomEvent('protheus:open-routine', { detail: { routine } }));
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Cálculo de dimensões SVG para o gráfico
  const svgMetrics = useMemo(() => {
    if (!chartData || !chartData.points || chartData.points.length === 0) return null;
    const maxVal = Math.max(...chartData.points.map(p => p.value), 1);
    const chartHeight = 160;
    const chartWidth = Math.max(chartData.points.length * 48, 280);
    const barWidth = Math.min(28, Math.max(16, (chartWidth / chartData.points.length) * 0.55));
    return { maxVal, chartHeight, chartWidth, barWidth };
  }, [chartData]);

  return (
    <article className="cprot-exec-card">
      {/* 1. Texto Executivo da Resposta */}
      <div className="cprot-exec-content">
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
            table: ({ node, ...props }) => <div className="cprot-markdown-table"><table {...props} /></div>,
          }}
        >
          {content || 'A análise foi concluída com sucesso.'}
        </ReactMarkdown>
      </div>

      {/* 2. Grid de KPI Cards Inline */}
      {kpiList.length > 0 && (
        <div className="cprot-kpi-grid">
          {kpiList.map((kpi, idx) => (
            <div 
              key={idx} 
              className={`cprot-kpi-card ${kpi.isGreen ? 'cprot-kpi-green' : 'cprot-kpi-blue'} ${kpi.value.length > 22 ? 'cprot-kpi-full' : ''}`}
            >
              <div className="cprot-kpi-header">
                {kpi.isGreen ? <TrendingUp size={13} className="cprot-kpi-icon-green" /> : <BarChart2 size={13} className="cprot-kpi-icon-blue" />}
                <span className="cprot-kpi-label">{kpi.label}</span>
              </div>
              <div className="cprot-kpi-value">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Gráfico Interativo Inline */}
      {chartData && svgMetrics && (
        <div className="cprot-chart-container">
          <div className="cprot-chart-title">{chartData.title}</div>
          <div className="cprot-chart-legend">
            <span className="cprot-chart-legend-box" />
            <span className="cprot-chart-legend-text">{chartData.legend}</span>
          </div>

          <div className="cprot-chart-scroll-wrapper">
            <svg 
              className="cprot-chart-svg" 
              viewBox={`0 0 ${svgMetrics.chartWidth + 60} ${svgMetrics.chartHeight + 45}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Linhas de Grade Horizontais */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = svgMetrics.chartHeight - (pct * (svgMetrics.chartHeight - 20)) + 5;
                const valLabel = formatNumber(Math.round(svgMetrics.maxVal * pct));
                return (
                  <g key={i}>
                    <line x1="50" y1={y} x2={svgMetrics.chartWidth + 50} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <text x="44" y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="Inter, sans-serif">
                      {valLabel}
                    </text>
                  </g>
                );
              })}

              {/* Barras e Rótulos */}
              {chartData.points.map((pt, i) => {
                const step = svgMetrics.chartWidth / chartData.points.length;
                const x = 55 + i * step + (step - svgMetrics.barWidth) / 2;
                const barH = Math.max(3, (pt.value / svgMetrics.maxVal) * (svgMetrics.chartHeight - 20));
                const y = svgMetrics.chartHeight + 5 - barH;

                return (
                  <g key={i} className="cprot-chart-bar-group">
                    <title>{`${pt.label}: ${formatCurrency(pt.value)}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={svgMetrics.barWidth}
                      height={barH}
                      rx="3"
                      ry="3"
                      fill="#2563EB"
                      className="cprot-chart-bar"
                    />
                    <text
                      x={x + svgMetrics.barWidth / 2}
                      y={svgMetrics.chartHeight + 20}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#64748B"
                      fontFamily="Inter, sans-serif"
                      transform={`rotate(-25, ${x + svgMetrics.barWidth / 2}, ${svgMetrics.chartHeight + 20})`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* 4. Card de Insights com 💡 */}
      {insightText && (
        <div className="cprot-insight-card">
          <div className="cprot-insight-icon-wrapper">
            <Lightbulb size={16} className="cprot-insight-icon" />
          </div>
          <div className="cprot-insight-text">
            {insightText}
          </div>
        </div>
      )}

      {/* 5. Accordion Filtros Aplicados */}
      <div className="cprot-accordion">
        <button 
          type="button" 
          onClick={() => setShowFilters(!showFilters)} 
          className="cprot-accordion-trigger"
        >
          <div className="cprot-accordion-title">
            <Filter size={14} className="text-slate-500" />
            <span>Filtros Aplicados</span>
          </div>
          {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showFilters && (
          <div className="cprot-accordion-content">
            <div className="cprot-filters-tags">
              {appliedFilters.map((f, i) => (
                <div key={i} className="cprot-filter-chip">
                  <span className="cprot-filter-chip-label">{f.label}:</span>
                  <span className="cprot-filter-chip-val">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. Accordion Detalhamento */}
      <div className="cprot-accordion">
        <button 
          type="button" 
          onClick={() => setShowDetails(!showDetails)} 
          className="cprot-accordion-trigger"
        >
          <div className="cprot-accordion-title">
            <TableIcon size={14} className="text-slate-500" />
            <span>Detalhamento</span>
          </div>
          {showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showDetails && (
          <div className="cprot-accordion-content">
            {dashboard?.rows && dashboard.rows.length > 0 ? (
              <div className="cprot-table-wrapper">
                <table className="cprot-detail-table">
                  <thead>
                    <tr>
                      {(dashboard.columns || Object.keys(dashboard.rows[0])).map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.rows.slice(0, 15).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {(dashboard.columns || Object.keys(dashboard.rows[0])).map((col, colIdx) => (
                          <td key={colIdx}>{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dashboard.rows.length > 15 && (
                  <div className="cprot-table-footer">
                    Exibindo 15 de {dashboard.rows.length} registros. Exporte para Excel para visualizar tudo.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 text-xs text-slate-500">Nenhum registro bruto disponível.</div>
            )}
          </div>
        )}
      </div>

      {/* 7. Botões de Ação Rápida */}
      <div className="cprot-actions-container">
        <button 
          type="button" 
          onClick={handleOpenRoutine} 
          className="cprot-action-button"
        >
          <ExternalLink size={14} />
          <span>{routineAction.label}</span>
        </button>

        {dashboard?.rows && dashboard.rows.length > 0 && (
          <button 
            type="button" 
            onClick={handleExportExcel} 
            className="cprot-action-button"
          >
            <Download size={14} />
            <span>Exportar para Excel</span>
          </button>
        )}
      </div>

      {/* Notificação toast amigável */}
      {exportNotice && (
        <div className="cprot-toast-notice">
          <CheckCircle2 size={13} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* 8. Botão secundário de visão completa */}
      {dashboard && (
        <div className="cprot-secondary-expand">
          <button type="button" onClick={handleOpenDashboard} className="cprot-open-dash-btn">
            <Sparkles size={13} />
            <span>Explorar em painel lateral</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </article>
  );
}

import React, { useMemo } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardTitle from './DashboardTitle';
import KPIGrid from './KPIGrid';
import KPICard from './KPICard';
import ExecutiveInsightsCard from './ExecutiveInsightsCard';
import ChartCard from './ChartCard';
import FiltersAccordion from './FiltersAccordion';
import DetailsAccordion from './DetailsAccordion';
import DashboardFooter from './DashboardFooter';

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export function DashboardView({ dashboard, onBackToChat, onClose }) {
  const title = dashboard?.title || dashboard?.originPrompt || 'Faturamento por vendedor';

  // Processamento inteligente dos KPIs executivos (até 4 cards no grid 2x2)
  const kpiData = useMemo(() => {
    const list = [];
    const sourceKpis = dashboard?.kpis || [];

    if (sourceKpis.length > 0) {
      sourceKpis.slice(0, 4).forEach((k, idx) => {
        const isCurr = k.format === 'currency' || (typeof k.value === 'number' && !/PEDIDO|QTD|QUANT|COUNT|REGISTRO/i.test(k.label || ''));
        const valFormatted = isCurr ? formatCurrency(k.value) : (typeof k.value === 'number' ? k.value.toLocaleString('pt-BR') : String(k.value ?? '-'));
        
        let iconType = k.iconType || (idx === 0 ? 'chart' : idx === 1 ? 'award' : idx === 2 ? 'package' : 'trending');
        if (/LÍDER|MAIOR|TOP|CLIENTE|VENDEDOR/i.test(k.label || '')) iconType = 'award';
        if (/PEDIDO|QUANT|VOLUME|TOTAL DE/i.test(k.label || '')) iconType = 'package';
        if (/MÉDIA|TICKET/i.test(k.label || '')) iconType = 'trending';

        list.push({
          label: (k.label || 'INDICADOR').toUpperCase(),
          value: valFormatted,
          trend: k.highlight_text || null,
          iconType,
        });
      });
    }

    // Se vieram menos de 2 KPIs dos kpis regulares, tenta preencher com backend_kpis
    if (list.length < 2 && dashboard?.backend_kpis) {
      const bk = dashboard.backend_kpis;
      if (bk.total !== undefined && !list.some(item => /TOTAL|FATURAMENTO/i.test(item.label))) {
        list.unshift({
          label: 'FATURAMENTO TOTAL',
          value: formatCurrency(bk.total),
          trend: 'Mês atual',
          iconType: 'chart',
        });
      }
      if (bk.max_value !== undefined && !list.some(item => /MAIOR|LÍDER/i.test(item.label))) {
        list.push({
          label: `LÍDER (${bk.maior_ocorrencia_nome || 'TOP 1'})`.toUpperCase(),
          value: formatCurrency(bk.max_value),
          trend: bk.concentration ? `${bk.concentration.toFixed(1)}% do total` : null,
          iconType: 'award',
        });
      }
      if (bk.count !== undefined && list.length < 4) {
        list.push({
          label: 'TOTAL DE REGISTROS',
          value: bk.count.toLocaleString('pt-BR'),
          trend: 'Base analisada',
          iconType: 'package',
        });
      }
      if (bk.average !== undefined && list.length < 4) {
        list.push({
          label: 'MÉDIA POR REGISTRO',
          value: formatCurrency(bk.average),
          trend: 'Média geral',
          iconType: 'trending',
        });
      }
    }

    // Fallback padrão se estiver vazio
    if (list.length === 0) {
      return [
        { label: 'FATURAMENTO TOTAL', value: 'R$ 1.045.388,57', trend: '+12,5% vs. mês anterior', iconType: 'chart' },
        { label: 'MAIOR VENDEDOR', value: 'R$ 410.786,65', trend: '39,3% do total', iconType: 'award' },
        { label: 'TOTAL DE PEDIDOS', value: '184', trend: 'Volume acumulado', iconType: 'package' },
        { label: 'TICKET MÉDIO', value: 'R$ 5.681,45', trend: 'Por pedido', iconType: 'trending' },
      ];
    }

    return list;
  }, [dashboard]);

  // Processamento dos pontos da série para o ChartCard
  const chartPoints = useMemo(() => {
    if (dashboard?.series && dashboard.series.length > 0 && dashboard.series[0].points) {
      return dashboard.series[0].points;
    }
    const rows = dashboard?.rows || [];
    if (rows.length >= 2) {
      const keys = Object.keys(rows[0] || {});
      const dimKey = keys.find(k => /^(MES|MÊS|PERIODO|DATA|VENDEDOR|FILIAL|CLIENTE|CODIGO)/i.test(k)) || keys[0];
      const valKey = keys.find(k => /^(VALOR|FATUR|TOTAL|RECEITA|VALBRUT|SALDO)/i.test(k)) || keys[1];

      if (dimKey && valKey) {
        return rows.map(r => ({
          label: String(r[dimKey] || '').trim(),
          value: parseFloat(String(r[valKey] || '0').replace(/[^0-9.-]+/g, '')) || 0,
        }));
      }
    }
    return null;
  }, [dashboard]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden animate-fade-in font-sans">
      {/* 1. Header do Dashboard: ← Voltar ao chat | Dashboard | ✕ */}
      <DashboardHeader onBack={onBackToChat} onClose={onClose} />

      {/* 2. Área Rolável de Exploração Analítica */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin">
        {/* Título e Subtítulo */}
        <DashboardTitle title={title} />

        {/* Grid de KPIs Executivos (2x2) */}
        <KPIGrid>
          {kpiData.map((kpi, idx) => (
            <KPICard key={idx} {...kpi} />
          ))}
        </KPIGrid>

        {/* Diagnósticos & Insights Executivos (Analytics 2.0) */}
        <ExecutiveInsightsCard 
          insights={dashboard?.backend_insights} 
          backendKpis={dashboard?.backend_kpis}
        />

        {/* Gráfico quase em tela cheia do painel */}
        <ChartCard
          title={title}
          points={chartPoints}
        />

        {/* Acordeão de Filtros */}
        <FiltersAccordion filters={dashboard?.applied_filters} />

        {/* Acordeão de Detalhamento com Tabela e Excel */}
        <DetailsAccordion
          rows={dashboard?.rows}
          columns={dashboard?.columns}
          title={`Detalhamento por ${dashboard?.dimension || 'vendedor'}`}
        />
      </div>

      {/* 3. Rodapé Fixo: ← Voltar para a conversa */}
      <DashboardFooter onBack={onBackToChat} />
    </div>
  );
}

export default DashboardView;

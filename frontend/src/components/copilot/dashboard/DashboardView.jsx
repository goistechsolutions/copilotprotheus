import React, { useMemo } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardTitle from './DashboardTitle';
import KPIGrid from './KPIGrid';
import KPICard from './KPICard';
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

  // Processamento inteligente dos KPIs para o grid 2x
  const kpiData = useMemo(() => {
    let kpi1 = { label: 'FATURAMENTO TOTAL', value: 'R$ 1.045.388,57', trend: '+12,5% vs. mês anterior', iconType: 'chart' };
    let kpi2 = { label: 'MAIOR VENDEDOR', value: 'R$ 410.786,65', trend: '39,3% do total', iconType: 'user' };

    if (dashboard?.kpis && dashboard.kpis.length >= 2) {
      kpi1 = {
        label: (dashboard.kpis[0].label || 'FATURAMENTO').toUpperCase(),
        value: typeof dashboard.kpis[0].value === 'number' ? formatCurrency(dashboard.kpis[0].value) : String(dashboard.kpis[0].value),
        trend: dashboard.kpis[0].highlight_text || null,
        iconType: 'chart'
      };
      kpi2 = {
        label: (dashboard.kpis[1].label || 'MAIOR VALOR').toUpperCase(),
        value: typeof dashboard.kpis[1].value === 'number' ? formatCurrency(dashboard.kpis[1].value) : String(dashboard.kpis[1].value),
        trend: dashboard.kpis[1].highlight_text || null,
        iconType: 'user'
      };
    } else if (dashboard?.backend_kpis) {
      const bk = dashboard.backend_kpis;
      if (bk.total !== undefined) {
        kpi1.value = formatCurrency(bk.total);
      }
      if (bk.max_value !== undefined) {
        kpi2.value = formatCurrency(bk.max_value);
        if (bk.maior_ocorrencia_nome) {
          kpi2.label = `MAIOR (${bk.maior_ocorrencia_nome})`.toUpperCase();
        }
      }
    }

    return [kpi1, kpi2];
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Título e Subtítulo */}
        <DashboardTitle title={title} />

        {/* Grid de 2 KPIs */}
        <KPIGrid>
          <KPICard {...kpiData[0]} />
          <KPICard {...kpiData[1]} />
        </KPIGrid>

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

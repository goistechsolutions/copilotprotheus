import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { BarChartCard } from '../charts/BarChartCard';
import { LineChartCard } from '../charts/LineChartCard';
import { DonutChartCard } from '../charts/DonutChartCard';
import { DataGrid } from '../ui/DataGrid';
import { MetricCard } from '../kpis/MetricCard';
import { MetricsRow } from '../kpis/MetricsRow';
import { InsightCard } from '../insights/InsightCard';
import { InsightsGrid } from '../insights/InsightsGrid';
import { DollarSign, Users, ShoppingCart, Percent } from 'lucide-react';

/**
 * Dashboard Engine Renderer
 * Contrato universal de renderização da IA. Recebe o payload e delega
 * para as camadas de visualização correspondentes dependendo do screenType.
 */
export default function DashboardRenderer({ payload }) {
  // Mock data para demonstrar a camada visual funcionando
  const mockChartData = useMemo(() => [
    { name: 'Jan', value: 4000, secondary: 2400 },
    { name: 'Fev', value: 3000, secondary: 1398 },
    { name: 'Mar', value: 2000, secondary: 9800 },
    { name: 'Abr', value: 2780, secondary: 3908 },
    { name: 'Mai', value: 1890, secondary: 4800 },
    { name: 'Jun', value: 2390, secondary: 3800 },
  ], []);

  const mockTableData = useMemo(() => [
    { id: 1, filial: '0101', produto: 'Notebook', valor: 4500.00, status: 'Ativo' },
    { id: 2, filial: '0101', produto: 'Monitor 27', valor: 1200.00, status: 'Ativo' },
    { id: 3, filial: '0102', produto: 'Teclado', valor: 250.00, status: 'Inativo' },
    { id: 4, filial: '0102', produto: 'Mouse', valor: 150.00, status: 'Ativo' },
    { id: 5, filial: '0103', produto: 'Cadeira', valor: 1800.00, status: 'Ativo' },
  ], []);

  const mockColumns = useMemo(() => [
    { header: 'Filial', accessorKey: 'filial' },
    { header: 'Produto', accessorKey: 'produto' },
    { header: 'Valor (R$)', accessorKey: 'valor', cell: info => `R$ ${info.getValue().toFixed(2)}` },
    { header: 'Status', accessorKey: 'status' },
  ], []);

  if (!payload) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-400 p-8 text-center">
        <p className="mb-4">O Dashboard Engine aguarda instruções do Copiloto.</p>
        {/* Renderiza mock apenas para visualização da fase */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('render-mock-dashboard'))}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
        >
          Visualizar Mock Design System
        </button>
      </div>
    );
  }

  const { screenType, data } = payload;

  // Renderização genérica baseada nos novos componentes
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex h-full flex-col gap-6 p-4 sm:p-6 pb-20"
    >
      <header>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
          {screenType ? screenType.replace('-', ' ') : 'Dashboard Analytics'}
        </h1>
        <p className="text-slate-500 mt-1">Renderizado via Dashboard Engine & UI Enterprise</p>
      </header>
      
      {/* Fase 5: Componentes Base / KPIs */}
      <MetricsRow>
        {data?.kpis?.length > 0 ? (
          data.kpis.map((kpi, idx) => (
            <MetricCard 
              key={idx}
              title={kpi.label} 
              value={kpi.format === 'currency' ? `R$ ${kpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : kpi.value} 
              trend="up" 
              trendValue="0%" 
              icon={DollarSign} 
              color="blue" 
            />
          ))
        ) : (
          <>
            <MetricCard title="Receita Total" value="R$ 124.500" trend="up" trendValue="+14%" icon={DollarSign} color="emerald" />
            <MetricCard title="Novos Clientes" value="342" trend="up" trendValue="+5%" icon={Users} color="blue" />
            <MetricCard title="Ticket Médio" value="R$ 364,00" trend="down" trendValue="-2%" icon={ShoppingCart} color="amber" />
            <MetricCard title="Conversão" value="14.5%" trend="up" trendValue="+1.2%" icon={Percent} color="purple" />
          </>
        )}
      </MetricsRow>

      {/* Fase 6: Insights Inteligentes */}
      <InsightsGrid>
        <InsightCard 
          title="Atenção" 
          description="Aumento de inadimplência na Filial 0101 nos últimos 15 dias." 
          value="R$ 45.200 retidos"
          type="critical"
        />
        <InsightCard 
          title="Oportunidade" 
          description="Produtos parados da categoria 'Monitores' com alta busca." 
          value="+12% de margem sugerida"
          type="opportunity"
        />
      </InsightsGrid>
      
      {/* Fase 7: Recharts */}
      {data?.series?.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.series.map((s, idx) => (
            <BarChartCard key={idx} title={s.label} data={s.points} xAxisKey="label" color="#3b82f6" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
             <div className="col-span-1 lg:col-span-2">
                <LineChartCard title="Evolução de Vendas" data={mockChartData} />
             </div>
             <div className="col-span-1">
                <DonutChartCard title="Distribuição" data={mockChartData} />
             </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChartCard title="Comparativo Mensal" data={mockChartData} />
            <BarChartCard title="Vendas por Filial" data={mockChartData} color="#f59e0b" />
          </div>
        </>
      )}

    {/* Fase 8: React Table */}
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Detalhamento</h3>
      <DataGrid 
        data={data?.rows?.length > 0 ? data.rows : mockTableData} 
        columns={data?.columns?.length > 0 ? data.columns.map(col => ({ header: col, accessorKey: col })) : mockColumns} 
      />
    </div>
  </motion.div>
);
}

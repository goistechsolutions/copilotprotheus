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
  const formatLabel = (key) => {
    if (!key) return '';
    return key
      .replace(/^VALOR_TOTAL_BRUTO_/, 'Valor Total Bruto ')
      .replace(/^VALOR_FATURADO_TOTAL_/, 'Valor Faturado Total ')
      .replace(/_NF$/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDateTick = (str) => {
    if (typeof str === 'string' && str.length === 8 && !isNaN(str)) {
      return str.substring(6, 8) + '/' + str.substring(4, 6);
    }
    return str;
  };

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
  
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhum registro encontrado</h2>
        <p className="text-sm max-w-md">A consulta foi concluída, mas não retornou dados para o período e filtros solicitados.</p>
      </div>
    );
  }

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
      {data?.kpis?.length > 0 && (
        <MetricsRow>
          {data.kpis.map((kpi, idx) => (
            <MetricCard 
              key={idx}
              title={formatLabel(kpi.label)} 
              value={kpi.format === 'currency' ? `R$ ${kpi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : kpi.value} 
              trend="up" 
              trendValue="0%" 
              icon={DollarSign} 
              color="blue" 
            />
          ))}
        </MetricsRow>
      )}

      {/* Fase 6: Insights Inteligentes */}
      {data?.insights?.length > 0 && (
        <InsightsGrid>
          {data.insights.map((insight, idx) => (
            <InsightCard 
              key={idx}
              title={insight.title || "Insight"} 
              description={insight.description} 
              value={insight.value}
              type={insight.type || "info"}
            />
          ))}
        </InsightsGrid>
      )}
      
      {/* Fase 7: Recharts */}
      {data?.series?.length > 0 && (
        <div className={`grid grid-cols-1 gap-6 ${data.series.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
          {data.series.map((s, idx) => {
            const formattedPoints = s.points.map(p => ({ ...p, label: formatDateTick(p.label) }));
            return (
              <div key={idx} className={data.series.length === 1 ? "col-span-1" : ""}>
                <BarChartCard 
                  title={formatLabel(s.label)} 
                  data={formattedPoints} 
                  xAxisKey="label" 
                  color="#3b82f6" 
                />
              </div>
            );
          })}
        </div>
      )}

    {/* Fase 8: React Table */}
    {data?.rows?.length > 0 && (
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Detalhamento</h3>
        <DataGrid 
          data={data.rows} 
          columns={data?.columns?.length > 0 ? data.columns.map(col => ({ header: col, accessorKey: col })) : []} 
        />
      </div>
    )}
  </motion.div>
);
}

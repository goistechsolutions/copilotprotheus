import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Radar as RadarIcon,
  Maximize2,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';
import {
  FINANCIAL_SERIES_DATA,
  BRANCH_BREAKDOWN_DATA,
  CATEGORY_BREAKDOWN_DATA,
  RADAR_PERFORMANCE_DATA,
} from '../../data/executiveData';

export default function VisualAnalyticsSuite() {
  const { isDark } = useExecutive();
  const [activeTab, setActiveTab] = useState<'financial' | 'distribution' | 'cashflow' | 'radar'>('financial');
  const [metricView, setMetricView] = useState<'revenue' | 'ebitda' | 'margin'>('revenue');

  const formatCurrency = (val: number) => {
    return `R$ ${(val / 1000000).toFixed(2)}M`;
  };

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const textColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section id="visual-analytics-suite" className="rounded-3xl glass-card p-5 sm:p-6 space-y-5">
      {/* Analytics Suite Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0F66FF]/10 text-[#0F66FF] dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Análise Visual Avançada (Power BI Engine / Microsoft Fabric Quality)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualização multidimensional de dados integrados de faturamento (SF2), custos (SD2) e contabilidade (CT2).
          </p>
        </div>

        {/* Chart View Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'financial'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Receita & EBITDA</span>
          </button>
          <button
            onClick={() => setActiveTab('distribution')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'distribution'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Mix por Categoria</span>
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'cashflow'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Fluxo de Caixa (30d)</span>
          </button>
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'radar'
                ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <RadarIcon className="w-3.5 h-3.5" />
            <span>Radar de Eficiência</span>
          </button>
        </div>
      </div>

      {/* Main Chart Rendering Canvas */}
      <div className="h-[360px] w-full pt-2">
        {activeTab === 'financial' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={FINANCIAL_SERIES_DATA} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F66FF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0F66FF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEbitda" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={textColor} fontSize={11} tickLine={false} />
              <YAxis stroke={textColor} fontSize={11} tickLine={false} tickFormatter={val => `R$ ${(val / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#111827' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [`R$ ${(Number(value) / 1000000).toFixed(2)}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="receitaBruta" name="Receita Bruta (SF2)" stroke="#0F66FF" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
              <Area type="monotone" dataKey="custos" name="Custos & Despesas (SD2/CT2)" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorCustos)" />
              <Area type="monotone" dataKey="ebitda" name="EBITDA Operacional" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorEbitda)" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'distribution' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full gap-4 items-center">
            {/* Donut Chart Categories */}
            <div className="h-full flex flex-col items-center justify-center">
              <div className="text-xs font-bold text-slate-500 mb-2">Mix de Vendas por Família de Produtos</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={CATEGORY_BREAKDOWN_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {CATEGORY_BREAKDOWN_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`R$ ${(Number(value) / 1000000).toFixed(2)}M`, 'Receita']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Branch Bar Distribution */}
            <div className="h-full flex flex-col justify-center space-y-3 pr-4">
              <div className="text-xs font-bold text-slate-500">Participação por Filial (MTD)</div>
              {BRANCH_BREAKDOWN_DATA.map(item => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{item.name}</span>
                    <span>R$ {(item.revenue / 1000000).toFixed(2)}M ({item.share}%)</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.share}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={FINANCIAL_SERIES_DATA} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={textColor} fontSize={11} tickLine={false} />
              <YAxis stroke={textColor} fontSize={11} tickLine={false} tickFormatter={val => `R$ ${(val / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#111827' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E2E8F0',
                  borderRadius: '12px',
                }}
                formatter={(value: any) => [`R$ ${(Number(value) / 1000000).toFixed(2)}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="fluxoCaixa" name="Disponibilidade Líquida (SE8)" fill="#0F66FF" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ebitda" name="EBITDA Gerado" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'radar' && (
          <div className="h-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={RADAR_PERFORMANCE_DATA}>
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis dataKey="metric" stroke={textColor} fontSize={11} />
                <PolarRadiusAxis angle={30} domain={[60, 100]} stroke={textColor} />
                <Radar name="Matriz SP (01)" dataKey="MatrizSP" stroke="#0F66FF" fill="#0F66FF" fillOpacity={0.4} />
                <Radar name="Campinas Fabril (02)" dataKey="Campinas" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                <Radar name="Santos Portuária (03)" dataKey="Santos" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

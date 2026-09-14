import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

export function BarChartCard({ 
  title, 
  data, 
  dataKey = 'value', 
  xAxisKey = 'name', 
  color = '#2563eb', 
  onBarClick,
  series = null,
  isCurrency = true,
}) {
  const formatValue = (val) => {
    if (typeof val !== 'number') return val;
    return isCurrency 
      ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
      : val.toLocaleString('pt-BR');
  };

  const formatYAxis = (val) => {
    if (typeof val !== 'number') return val;
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title || 'Gráfico de Barras'}</CardTitle>
        {onBarClick && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
            Clique na barra para drill-down
          </span>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatYAxis} />
            <Tooltip 
              cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
              formatter={(value, name) => [formatValue(value), name]}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            {series && series.length > 0 ? (
              <>
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                {series.map((s, idx) => (
                  <Bar 
                    key={idx}
                    dataKey={s.dataKey}
                    name={s.label || s.dataKey}
                    fill={s.color || color}
                    radius={[4, 4, 0, 0]}
                    onClick={(state) => {
                      if (onBarClick && state && state.activePayload && state.activePayload[0]) {
                        onBarClick(state.activePayload[0].payload);
                      }
                    }}
                    className={onBarClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
                  />
                ))}
              </>
            ) : (
              <Bar 
                dataKey={dataKey} 
                fill={color} 
                radius={[4, 4, 0, 0]} 
                onClick={(state) => {
                  if (onBarClick && state && state.activePayload && state.activePayload[0]) {
                    onBarClick(state.activePayload[0].payload);
                  }
                }}
                className={onBarClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


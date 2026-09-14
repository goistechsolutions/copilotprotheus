import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

export function LineChartCard({ 
  title, 
  data, 
  dataKey = 'value', 
  xAxisKey = 'name', 
  color = '#10b981',
  referenceLineY,
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
      <CardHeader>
        <CardTitle>{title || 'Série Temporal'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={formatYAxis} />
            <Tooltip 
              formatter={(value, name) => [formatValue(value), name]}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullLabel || item?.fullDate || label;
              }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            {referenceLineY !== undefined && (
              <ReferenceLine y={referenceLineY} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Equilíbrio (R$ 0)', fill: '#94a3b8', fontSize: 11, position: 'insideTopRight' }} />
            )}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={3} 
              dot={{ r: 4, strokeWidth: 2 }} 
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


import React, { useMemo } from 'react';

const formatCompactAxis = (val) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)} mil`;
  return String(val);
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export function ChartCard({ 
  title = 'Faturamento por vendedor', 
  points = [] 
}) {
  // Dados de fallback caso venha vazio
  const displayPoints = useMemo(() => {
    if (points && points.length > 0) return points;
    return [
      { label: '01', value: 410786 },
      { label: '02', value: 165420 },
      { label: '03', value: 132100 },
      { label: '04', value: 98400 },
      { label: '05', value: 76200 },
      { label: '06', value: 54100 },
      { label: '07', value: 42300 },
      { label: '08', value: 31200 },
      { label: '09', value: 21500 },
      { label: '10', value: 13362 },
    ];
  }, [points]);

  const maxVal = Math.max(...displayPoints.map(p => p.value), 1);
  const height = 150;
  const barWidth = Math.min(22, Math.max(12, (280 / displayPoints.length) * 0.55));

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs my-3">
      <div className="text-xs font-bold text-[var(--color-text)] mb-3">
        {title}
      </div>

      <div className="relative w-full overflow-x-auto pb-1 scrollbar-thin">
        <svg
          className="w-full min-w-[280px] h-[160px] block overflow-visible"
          viewBox={`0 0 320 ${height + 25}`}
        >
          {/* Linhas de Grade e Eixo Y */}
          {[1, 0.66, 0.33, 0].map((ratio, i) => {
            const y = height - (ratio * (height - 20)) + 5;
            const val = Math.round(maxVal * ratio);
            return (
              <g key={i}>
                <line
                  x1="45"
                  y1={y}
                  x2="315"
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray="2 2"
                  opacity={0.6}
                />
                <text
                  x="40"
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--color-muted)"
                  fontFamily="inherit"
                >
                  {formatCompactAxis(val)}
                </text>
              </g>
            );
          })}

          {/* Barras e Eixo X */}
          {displayPoints.map((pt, i) => {
            const step = (320 - 55) / displayPoints.length;
            const x = 55 + i * step + (step - barWidth) / 2;
            const barH = Math.max(3, (pt.value / maxVal) * (height - 20));
            const y = height + 5 - barH;

            return (
              <g key={i} className="group">
                <title>{`${pt.label}: ${formatCurrency(pt.value)}`}</title>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="3"
                  className="fill-[#2563eb] hover:fill-[#1d4ed8] transition-colors cursor-pointer"
                />
                <text
                  x={x + barWidth / 2}
                  y={height + 18}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--color-muted)"
                  fontFamily="inherit"
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default ChartCard;

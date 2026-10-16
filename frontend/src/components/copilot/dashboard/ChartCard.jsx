import React, { useMemo } from 'react';
import { Award, BarChart3 } from 'lucide-react';

const formatCompactAxis = (val) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(val);
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
};

export function ChartCard({ 
  title = 'Faturamento por vendedor', 
  points = [] 
}) {
  // Dados tratados e ordenados por valor decrescente
  const displayPoints = useMemo(() => {
    if (points && points.length > 0) {
      return [...points].sort((a, b) => (b.value || 0) - (a.value || 0));
    }
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

  // Limpa o título para parecer um relatório executivo em vez do comando de chat do usuário
  const cleanTitle = useMemo(() => {
    if (!title) return 'Distribuição de Faturamento';
    if (/resuma|mostre|liste|quais|qual/i.test(title)) {
      if (/vendedor/i.test(title)) return 'Ranking de Faturamento por Vendedor';
      if (/cliente/i.test(title)) return 'Ranking de Compras por Cliente';
      if (/produto/i.test(title)) return 'Ranking de Vendas por Produto';
      if (/receber|inadimpl/i.test(title)) return 'Distribuição de Títulos a Receber';
      if (/pagar/i.test(title)) return 'Distribuição de Títulos a Pagar';
      return 'Distribuição Consolidada de Valores';
    }
    return title;
  }, [title]);

  const totalSum = useMemo(() => displayPoints.reduce((acc, p) => acc + (p.value || 0), 0), [displayPoints]);
  const maxVal = Math.max(...displayPoints.map(p => p.value), 1);
  const topPoint = displayPoints[0];
  const topShare = totalSum > 0 && topPoint ? ((topPoint.value / totalSum) * 100).toFixed(1) : null;

  const height = 150;
  const barWidth = Math.min(24, Math.max(12, (270 / displayPoints.length) * 0.65));

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs my-2.5">
      {/* Header do Gráfico com Título e Badge de Líder */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={15} className="text-blue-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--color-text)]">
            {cleanTitle}
          </span>
        </div>

        {topPoint && topShare && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-500 shrink-0">
            <Award size={11} />
            <span>Top 1: {topPoint.label} ({topShare}%)</span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-x-auto pb-1 scrollbar-thin">
        <svg
          className="w-full min-w-[290px] h-[165px] block overflow-visible"
          viewBox={`0 0 330 ${height + 25}`}
        >
          <defs>
            <linearGradient id="primaryBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="leaderBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade e Eixo Y */}
          {[1, 0.66, 0.33, 0].map((ratio, i) => {
            const y = height - (ratio * (height - 25)) + 8;
            const val = Math.round(maxVal * ratio);
            return (
              <g key={i}>
                <line
                  x1="45"
                  y1={y}
                  x2="325"
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
                <text
                  x="40"
                  y={y + 3}
                  textAnchor="end"
                  fontSize="8.5"
                  fill="var(--color-muted)"
                  fontFamily="inherit"
                  fontWeight="600"
                >
                  {formatCompactAxis(val)}
                </text>
              </g>
            );
          })}

          {/* Barras e Rótulos */}
          {displayPoints.map((pt, i) => {
            const step = (330 - 55) / displayPoints.length;
            const x = 52 + i * step + (step - barWidth) / 2;
            const barH = Math.max(4, (pt.value / maxVal) * (height - 25));
            const y = height + 8 - barH;
            const isLeader = i === 0;

            return (
              <g key={i} className="group transition-transform cursor-pointer">
                <title>{`${pt.label}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pt.value)}`}</title>
                
                {/* Rótulo de valor nos Top 3 para leitura imediata */}
                {i < 3 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="7.5"
                    fill={isLeader ? '#10b981' : 'var(--color-muted)'}
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {formatCompactAxis(pt.value)}
                  </text>
                )}

                {/* Barra com bordas arredondadas no topo */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="4"
                  fill={isLeader ? 'url(#leaderBarGrad)' : 'url(#primaryBarGrad)'}
                  className="hover:opacity-90 transition-opacity"
                />

                {/* Rótulo da entidade no eixo X */}
                <text
                  x={x + barWidth / 2}
                  y={height + 20}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill={isLeader ? 'var(--color-text)' : 'var(--color-muted)'}
                  fontWeight={isLeader ? '700' : '500'}
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

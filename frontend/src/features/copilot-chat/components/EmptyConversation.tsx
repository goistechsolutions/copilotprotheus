import React from 'react';

interface EmptyConversationProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyConversation({ onSelectPrompt }: EmptyConversationProps) {
  const starterItems = [
    {
      label: 'Financeiro',
      desc: 'Fluxo de caixa, recebíveis e atrasos',
      icon: '💰',
      prompt: 'Resuma a situação do Fluxo de Caixa e contas a receber dos próximos 30 dias',
    },
    {
      label: 'Vendas',
      desc: 'Faturamento e performance',
      icon: '📈',
      prompt: 'Resuma o faturamento acumulado do mês atual comparado por vendedor',
    },
    {
      label: 'Estoque',
      desc: 'Saldos e produtos sem giro',
      icon: '📦',
      prompt: 'Identifique produtos parados sem movimentação nos últimos 90 dias',
    },
    {
      label: 'Fiscal',
      desc: 'Impostos e retenções',
      icon: '📄',
      prompt: 'Resuma os valores de impostos retidos no período atual',
    },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      margin: 'auto 0',
      textAlign: 'center',
      userSelect: 'none',
      width: '100%'
    }} className="animate-fade-in">

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 600,
          margin: '0 0 12px 0',
          color: 'var(--cprot-text-main)',
          letterSpacing: '-0.02em'
        }}>
          Bem-vindo ao Copilot Executivo
        </h2>
        <p style={{
          fontSize: '16px',
          fontWeight: 400,
          margin: 0,
          color: 'var(--cprot-text-sub)',
          lineHeight: '1.5',
          maxWidth: '400px'
        }}>
          Analise dados Financeiros, Comerciais, <br />
          Estoque, Compras, Fiscal e Controladoria.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '12px', 
        width: '100%', 
        maxWidth: '480px' 
      }}>
        {starterItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              background: 'var(--cprot-surface)',
              border: '1px solid var(--cprot-border)',
              borderRadius: '16px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.2s, transform 0.1s',
              fontFamily: 'inherit',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--cprot-surface-hover)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--cprot-surface)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(1px)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--cprot-text-main)' }}>
                {item.label}
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--cprot-text-muted)' }}>
              {item.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

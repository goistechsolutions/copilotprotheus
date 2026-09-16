import React from 'react';
import { SparklesIcon } from './icons';

interface EmptyConversationProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyConversation({ onSelectPrompt }: EmptyConversationProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia.';
    if (hour < 18) return 'Boa tarde.';
    return 'Boa noite.';
  };

  const starterItems = [
    {
      label: 'Fluxo de Caixa',
      prompt: 'Projeção de fluxo de caixa e recebimentos dos próximos 30 dias',
    },
    {
      label: 'Vendas',
      prompt: 'Faturamento acumulado do mês atual comparado por vendedor',
    },
    {
      label: 'Clientes',
      prompt: 'Clientes com títulos vencidos acima de 60 dias e risco de inadimplência',
    },
    {
      label: 'Estoque',
      prompt: 'Identificar produtos parados sem movimentação nos últimos 90 dias com saldo em estoque',
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
    }} className="animate-fade-in">
      {/* Brand Minimal */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '18px',
          color: 'var(--cprot-text-main)',
        }}>
          <SparklesIcon size={18} />
          <span>Copilot Protheus</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--cprot-text-muted)', marginTop: '4px' }}>
          Inteligência Corporativa
        </div>
      </div>

      {/* Saudação Central */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 600,
          margin: '0 0 6px 0',
          color: 'var(--cprot-text-main)',
        }}>
          {getGreeting()}
        </h2>
        <p style={{
          fontSize: '15px',
          fontWeight: 400,
          margin: 0,
          color: 'var(--cprot-text-sub)',
        }}>
          O que deseja analisar hoje?
        </p>
      </div>

      {/* Lista de Opções em Texto Puro (Sem cards, sem caixas) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '240px' }}>
        {starterItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cprot-text-sub)',
              fontSize: '15px',
              fontWeight: 400,
              padding: '6px 0',
              cursor: 'pointer',
              transition: 'color 0.15s, transform 0.1s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--cprot-primary)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--cprot-text-sub)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

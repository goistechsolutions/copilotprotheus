import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  TrendingUp,
  Boxes,
  DollarSign,
  ShieldAlert,
  Database,
  Building2,
  X,
  ArrowRight,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';
import { ExecutiveDomain } from '../../types/executive';

export default function CommandPaletteModal() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveDomain,
    sendMessage,
    setSelectedBranch,
    selectedCompany,
  } = useExecutive();

  const [query, setQuery] = useState('');

  if (!commandPaletteOpen) return null;

  const quickActions = [
    {
      title: 'Saúde Financeira & Caixa (SIGAFIN)',
      desc: 'Ir para análise de fluxo de caixa, EBITDA e contas a receber',
      icon: DollarSign,
      domain: 'financial' as ExecutiveDomain,
      type: 'navigate',
    },
    {
      title: 'Comercial & Faturamento (SIGAFAT)',
      desc: 'Ranking de vendas por filial e margem por produto',
      icon: TrendingUp,
      domain: 'commercial' as ExecutiveDomain,
      type: 'navigate',
    },
    {
      title: 'Almoxarifado & Estoque (SIGAEST)',
      desc: 'Itens em ponto de pedido e risco de obsolescência',
      icon: Boxes,
      domain: 'inventory' as ExecutiveDomain,
      type: 'navigate',
    },
    {
      title: 'Consultar Risco do Cliente Metalúrgica Paulista (CLI-0041)',
      desc: 'Verificar títulos vencidos e limite de crédito tomado na SE1010',
      icon: ShieldAlert,
      prompt: 'Qual o risco de inadimplência e títulos vencidos do cliente Metalúrgica Paulista?',
      type: 'copilot',
    },
    {
      title: 'Auditar Dicionário SX2/SX3 das Tabelas Financeiras',
      desc: 'Mapeamento de chaves e campos contábeis no Protheus',
      icon: Database,
      prompt: 'Apresentar a estrutura de campos das tabelas SE1010 e SE2010 no dicionário Protheus.',
      type: 'copilot',
    },
  ];

  const filtered = quickActions.filter(
    a => a.title.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Digite um comando, KPI, cliente ou pergunta executiva..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Results */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-1 custom-scrollbar">
          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Ações Rápidas & Navegação
          </div>
          {filtered.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (action.type === 'navigate' && action.domain) {
                    setActiveDomain(action.domain);
                  } else if (action.type === 'copilot' && action.prompt) {
                    sendMessage(action.prompt);
                  }
                  setCommandPaletteOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-[#0F66FF] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0F66FF] dark:group-hover:text-blue-400 transition-colors">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{action.desc}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Pressione ESC para fechar</span>
          <span>PROTHEUS COPILOTO EXECUTIVO</span>
        </div>
      </div>
    </div>
  );
}

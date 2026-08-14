import React from 'react';
import {
  FileText, TrendingUp, CalendarClock, BarChart3, Package,
  AlertTriangle, Boxes, ClipboardList, Factory, Gauge, Users, Receipt
} from 'lucide-react';

// Mapa de sugestões por módulo Protheus
const MODULE_PROMPTS = {
  FIN: [
    { icon: FileText, title: 'Consultar contas a pagar', desc: 'Listar títulos do período atual', prompt: 'Liste as contas a pagar do período atual' },
    { icon: TrendingUp, title: 'Prever recebimentos', desc: 'Análise de recebimentos esperados', prompt: 'Faça uma previsão de recebimentos para os próximos 30 dias' },
    { icon: CalendarClock, title: 'Melhor data de pagamento', desc: 'Simular datas para economia', prompt: 'Qual a melhor data para pagar os títulos em aberto considerando descontos?' },
    { icon: BarChart3, title: 'Análise de vendas', desc: 'Resumo de vendas do mês', prompt: 'Resuma as vendas deste mês por filial' },
  ],
  EST: [
    { icon: Package, title: 'Saldo por lote', desc: 'Consultar rastreabilidade', prompt: 'Mostre o saldo de estoque por lote' },
    { icon: AlertTriangle, title: 'Itens críticos', desc: 'Produtos abaixo do estoque mínimo', prompt: 'Quais produtos estão abaixo do estoque mínimo?' },
    { icon: Boxes, title: 'Giro de estoque', desc: 'Análise de giro por período', prompt: 'Calcule o giro de estoque dos últimos 90 dias' },
    { icon: ClipboardList, title: 'Divergências de inventário', desc: 'Comparar saldo físico x sistema', prompt: 'Liste as divergências do último inventário' },
  ],
  FAT: [
    { icon: Receipt, title: 'Faturamento do período', desc: 'Total faturado por filial', prompt: 'Qual o faturamento total por filial este mês?' },
    { icon: ClipboardList, title: 'Pedidos pendentes', desc: 'Pedidos aguardando faturamento', prompt: 'Liste os pedidos pendentes de faturamento' },
    { icon: TrendingUp, title: 'Margem por produto', desc: 'Análise de rentabilidade', prompt: 'Mostre a margem de contribuição por produto' },
    { icon: Users, title: 'Top clientes', desc: 'Ranking de faturamento', prompt: 'Quais são os 10 maiores clientes em faturamento?' },
  ],
  PCP: [
    { icon: Factory, title: 'Ordens em produção', desc: 'Status das ordens abertas', prompt: 'Mostre o status das ordens de produção abertas' },
    { icon: AlertTriangle, title: 'Ordens atrasadas', desc: 'Atrasos na produção', prompt: 'Quais ordens de produção estão atrasadas?' },
    { icon: Gauge, title: 'Capacidade produtiva', desc: 'Ocupação por recurso', prompt: 'Qual a ocupação atual da capacidade produtiva?' },
    { icon: Boxes, title: 'Consumo de insumos', desc: 'Análise de consumo por período', prompt: 'Resuma o consumo de insumos deste mês' },
  ],
};

const DEFAULT_MODULE = 'FIN';

export default function QuickPrompts({ module, onSelect }) {
  const prompts = MODULE_PROMPTS[module] || MODULE_PROMPTS[DEFAULT_MODULE];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {prompts.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            onClick={() => onSelect(item.prompt)}
            className="text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-colors">
              <Icon className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-slate-800 leading-tight mb-0.5">{item.title}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Search,
  Building2,
  ChevronDown,
  User,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Bot,
  Send,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  ShoppingBag,
  ShoppingCart,
  Package,
  BookOpen,
  Truck,
  Tag,
  PieChart,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Scale,
  Award,
  Activity,
  Calculator,
  Database,
  MessageSquare
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';

// Configurações das Áreas Executivas
const AREAS_CONFIG = {
  financeiro: {
    id: 'financeiro',
    label: 'Financeiro',
    module: 'SIGAFIN',
    icon: Wallet,
    title: 'Visão Geral Financeira',
    subtitle: 'Painel consolidado de liquidez, duplicatas e conciliação bancária',
    bannerBadge: 'Inteligência Financeira Ativa',
    bannerTitle: 'Gestão de Liquidez & Tesouraria Protheus',
    bannerSubtitle: 'Dados de Contas a Pagar/Receber e Bancos sincronizados via QueryRest',
    bannerMetricLabel: 'Previsão de Receita',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Saldo Disponível',
        value: '---',
        change: '+4.2%',
        isPositive: true,
        icon: Wallet,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Contas a Pagar (SE2)',
        value: '---',
        change: '+1.5%',
        isPositive: false,
        icon: ArrowDownRight,
        color: '#ef4444',
        bgColor: '#fef2f2'
      },
      {
        label: 'Contas a Receber (SE1)',
        value: '---',
        change: '+8.7%',
        isPositive: true,
        icon: ArrowUpRight,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Lucro Líquido / EBITDA',
        value: '---',
        change: '+12.4%',
        isPositive: true,
        icon: TrendingUp,
        isHighlight: true
      }
    ],
    chartTitle: 'Fluxo de Caixa Projetado',
    chartSubtitle: 'Projeção de liquidez para as próximas semanas',
    compositionTitle: 'Composição de Despesas',
    compositionSubtitle: 'Maiores centros de custos no período',
    compositionItems: [
      { label: 'Folha de Pagamento', percentage: 45, detail: '---', color: '#004fce' },
      { label: 'Fornecedores / Insumos', percentage: 32, detail: '---', color: '#0f66ff' },
      { label: 'Tributário e Impostos', percentage: 15, detail: '---', color: '#f59e0b' },
      { label: 'Infraestrutura / TI', percentage: 8, detail: '---', color: '#64748b' }
    ],
    tableTitle: 'Últimas Movimentações Financeiras',
    tableSubtitle: 'Títulos e duplicatas integradas via SE1 / SE2',
    tableHeaders: ['Vencimento / Data', 'Descrição / Titular', 'Tipo', 'Valor', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! Notei uma variação de 12% no DDA para o próximo vencimento no Protheus. Deseja que eu analise o detalhamento das duplicatas a pagar?',
    copilotSuggestions: ['Sim, analisar DDA', 'Duplicatas a pagar', 'Inadimplência de clientes']
  },

  vendas: {
    id: 'vendas',
    label: 'Vendas',
    module: 'SIGAFAT',
    icon: TrendingUp,
    title: 'Performance Comercial & Vendas',
    subtitle: 'Acompanhamento de faturamento, pedidos de venda (SC5) e clientes',
    bannerBadge: 'Gestão de Faturamento Protheus',
    bannerTitle: 'Inteligência de Vendas & Curva ABC de Clientes',
    bannerSubtitle: 'Cruzamento de notas fiscais (SF2/SD2) e carteira de pedidos',
    bannerMetricLabel: 'Meta do Mês (81.6%)',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Faturamento Acumulado',
        value: '---',
        change: '+14.8%',
        isPositive: true,
        icon: TrendingUp,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Pedidos Emitidos (SC5)',
        value: '291 pedidos',
        change: '+8.2%',
        isPositive: true,
        icon: ShoppingBag,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Ticket Médio por Venda',
        value: '---',
        change: '+3.5%',
        isPositive: true,
        icon: Tag,
        color: '#0f66ff',
        bgColor: '#f5faff'
      },
      {
        label: 'Margem Bruta Média',
        value: '34.8%',
        change: '+1.9%',
        isPositive: true,
        icon: PieChart,
        isHighlight: true
      }
    ],
    chartTitle: 'Evolução de Vendas Diárias vs Meta',
    chartSubtitle: 'Valores faturados e volume diário de pedidos',
    compositionTitle: 'Faturamento por Categoria',
    compositionSubtitle: 'Participação das linhas de produtos',
    compositionItems: [
      { label: 'Linha Industrial / Peças', percentage: 48, detail: '---', color: '#004fce' },
      { label: 'Linha Varejo / Consumo', percentage: 28, detail: '---', color: '#0f66ff' },
      { label: 'Contratos de Serviços', percentage: 16, detail: '---', color: '#22c55e' },
      { label: 'Acessórios e Outros', percentage: 8, detail: '---', color: '#64748b' }
    ],
    tableTitle: 'Últimos Pedidos de Venda',
    tableSubtitle: 'Pedidos registrados no Protheus (SC5 / SC6)',
    tableHeaders: ['Número / Emissão', 'Cliente (SA1)', 'Filial', 'Valor Total', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! O faturamento acumulado de vendas já atingiu 81.6% da meta mensal. Deseja ver os 10 clientes com maior volume de compras este mês?',
    copilotSuggestions: ['Top 10 clientes', 'Pedidos de hoje', 'Faturamento por filial']
  },

  compras: {
    id: 'compras',
    label: 'Compras',
    module: 'SIGACOM',
    icon: ShoppingCart,
    title: 'Gestão de Suprimentos & Compras',
    subtitle: 'Controle de pedidos de compra (SC7), cotações e fornecedores (SA2)',
    bannerBadge: 'Gestão de Suprimentos Ativa',
    bannerTitle: 'Otimização de Custos & Compras Estratégicas',
    bannerSubtitle: 'Monitoramento de lead time e ordens de compra pendentes',
    bannerMetricLabel: 'Volume Total em Compras',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Volume de Compras no Mês',
        value: '---',
        change: '-4.1%',
        isPositive: true,
        icon: ShoppingCart,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Pedidos de Compra Abertos',
        value: '42 pedidos',
        change: '-5 pedidos',
        isPositive: true,
        icon: Clock,
        color: '#f59e0b',
        bgColor: '#fefce8'
      },
      {
        label: 'Lead Time Médio',
        value: '6.2 dias',
        change: '-0.8 dias',
        isPositive: true,
        icon: Truck,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Economia em Negociações',
        value: '---',
        change: '+7.5% saving',
        isPositive: true,
        icon: ShieldCheck,
        isHighlight: true
      }
    ],
    chartTitle: 'Histórico de Compras por Categoria',
    chartSubtitle: 'Valores mensais de aquisição de insumos e matérias-primas',
    compositionTitle: 'Distribuição por Grupo de Compras',
    compositionSubtitle: 'Categorias com maior impacto no orçamento',
    compositionItems: [
      { label: 'Matérias-Primas', percentage: 52, detail: '---', color: '#004fce' },
      { label: 'Embalagens e Descartáveis', percentage: 24, detail: '---', color: '#0f66ff' },
      { label: 'Manutenção / MRO', percentage: 14, detail: '---', color: '#f59e0b' },
      { label: 'Serviços Terceirizados', percentage: 10, detail: '---', color: '#64748b' }
    ],
    tableTitle: 'Pedidos de Compra Pendentes de Entrega',
    tableSubtitle: 'Ordens de compra ativas no Protheus (SC7)',
    tableHeaders: ['Ordem / Emissão', 'Fornecedor (SA2)', 'Previsão Entrega', 'Valor Total', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! Há 4 pedidos de compra com prazo de entrega para esta semana no Protheus. Deseja verificar se algum fornecedor está com entrega em atraso?',
    copilotSuggestions: ['Pedidos com atraso', 'Top fornecedores', 'Cotações pendentes']
  },

  estoque: {
    id: 'estoque',
    label: 'Estoque',
    module: 'SIGAEST',
    icon: Package,
    title: 'Controle Físico & Financeiro de Estoque',
    subtitle: 'Saldos de almoxarifado (SB2), movimentações (SD3) e itens críticos',
    bannerBadge: 'Controle de Inventário Ativo',
    bannerTitle: 'Gestão Inteligente de Saldos & Reposição',
    bannerSubtitle: 'Monitoramento de giro de estoque, curva ABC e ponto de pedido',
    bannerMetricLabel: 'Valor Total em Estoque',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Valor Total do Estoque (SB2)',
        value: '---',
        change: '-2.3%',
        isPositive: true,
        icon: Package,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Giro Anual do Estoque',
        value: '4.8x / ano',
        change: '+0.4x',
        isPositive: true,
        icon: RefreshCw,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Itens em Ponto de Pedido',
        value: '18 produtos',
        change: 'Abaixo do mínimo',
        isPositive: false,
        icon: AlertTriangle,
        color: '#f59e0b',
        bgColor: '#fefce8'
      },
      {
        label: 'Acuracidade de Inventário',
        value: '98.6%',
        change: '+0.8% acurácia',
        isPositive: true,
        icon: CheckCircle2,
        isHighlight: true
      }
    ],
    chartTitle: 'Saldos de Estoque por Armazém (NNR)',
    chartSubtitle: 'Valores monetários alocados por local físico',
    compositionTitle: 'Curva ABC de Estoque',
    compositionSubtitle: 'Distribuição de valor por classe de produto',
    compositionItems: [
      { label: 'Classe A (Alto Valor)', percentage: 70, detail: '---', color: '#004fce' },
      { label: 'Classe B (Médio Valor)', percentage: 20, detail: '---', color: '#0f66ff' },
      { label: 'Classe C (Baixo Valor)', percentage: 10, detail: '---', color: '#64748b' }
    ],
    tableTitle: 'Itens Críticos / Ponto de Reposição',
    tableSubtitle: 'Produtos com saldo próximo ou abaixo do estoque de segurança (SB1)',
    tableHeaders: ['Código / Descrição', 'Armazém', 'Saldo Atual', 'Ponto Pedido', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! Identifiquei 18 produtos com saldo abaixo do ponto de reposição na filial 0101. Deseja gerar a listagem completa com sugestão de compra?',
    copilotSuggestions: ['Listar itens críticos', 'Estoque parado > 90 dias', 'Saldo por armazém']
  },

  contabilidade: {
    id: 'contabilidade',
    label: 'Contabilidade',
    module: 'SIGACTB',
    icon: BookOpen,
    title: 'Controladoria & Demonstrações Contábeis',
    subtitle: 'Balancete, razão contábil (CT2) e apuração de resultados (DRE)',
    bannerBadge: 'Controladoria & Compliance',
    bannerTitle: 'Demonstrações Financeiras & DRE Gerencial',
    bannerSubtitle: 'Estrutura patrimonial, liquidez corrente e conciliação de contas',
    bannerMetricLabel: 'Patrimônio Líquido',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Ativo Total Consolidado',
        value: '---',
        change: '+5.4% no exercício',
        isPositive: true,
        icon: BookOpen,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Passivo Circulante',
        value: '---',
        change: '-2.1% no período',
        isPositive: true,
        icon: Scale,
        color: '#64748b',
        bgColor: '#f8fafc'
      },
      {
        label: 'Patrimônio Líquido',
        value: '---',
        change: '+7.8% no exercício',
        isPositive: true,
        icon: Award,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Índice de Liquidez Corrente',
        value: '2.42x',
        change: 'Saudável (> 1.5)',
        isPositive: true,
        icon: Activity,
        isHighlight: true
      }
    ],
    chartTitle: 'DRE Sintético - Resultados Mensais',
    chartSubtitle: 'Receita Líquida, Custos Operacionais e Lucro antes de Impostos (LAIR)',
    compositionTitle: 'Estrutura do Balanço Patrimonial',
    compositionSubtitle: 'Distribuição dos ativos da empresa',
    compositionItems: [
      { label: 'Ativo Circulante (Disponível + Recebíveis)', percentage: 62, detail: '---', color: '#004fce' },
      { label: 'Ativo Não Circulante (Imobilizado / Intangível)', percentage: 38, detail: '---', color: '#0f66ff' }
    ],
    tableTitle: 'Lançamentos Contábeis Recentes',
    tableSubtitle: 'Lote contábil ativo no Protheus (CT2 / CT1)',
    tableHeaders: ['Data / Lote', 'Conta Débito / Crédito', 'Histórico do Lançamento', 'Valor', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! O fechamento contábil preliminar deste mês aponta um EBITDA de 22.4% e índice de liquidez de 2.42x. Deseja visualizar o DRE consolidado?',
    copilotSuggestions: ['DRE consolidado', 'Balancete do mês', 'Lançamentos manuais']
  }
};

export default function ExecutiveDashboard({ initialArea, onNavigateToWorkspace, context }) {
  const [activeAreaKey, setActiveAreaKey] = useState(initialArea || 'financeiro');
  const [period, setPeriod] = useState('Mês Atual');
  const [chartView, setChartView] = useState('semanal');
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  useEffect(() => {
    if (initialArea && AREAS_CONFIG[initialArea]) {
      setActiveAreaKey(initialArea);
    }
  }, [initialArea]);

  const currentArea = AREAS_CONFIG[activeAreaKey] || AREAS_CONFIG.financeiro;

  // Atualiza as mensagens do Copilot quando troca de área
  useEffect(() => {
    setCopilotMessages([
      {
        role: 'assistant',
        text: currentArea.initialCopilotMsg,
        suggestions: currentArea.copilotSuggestions
      }
    ]);
  }, [activeAreaKey]);

  // Manipulador de envio de pergunta para o Copilot no painel lateral
  const handleSendCopilot = async (customPrompt) => {
    const question = customPrompt || copilotQuestion;
    if (!question.trim() || isCopilotLoading) return;

    const userTurn = { role: 'user', text: question };
    setCopilotMessages(prev => [...prev, userTurn]);
    setCopilotQuestion('');
    setIsCopilotLoading(true);

    try {
      if (!context.tenant_id || !context.environment || !context.company || !context.branch) {
        throw new Error('Contexto multi-tenant ausente ou incompleto.');
      }
      
      const response = await askAgent({
        prompt: question,
        tenant_id: context.tenant_id,
        environment_code: context.environment,
        empresa: context.company,
        filial: context.branch,
        module: currentArea.module,
        conversation_id: `dash-${activeAreaKey}-${Date.now()}`
      });

      let replyText = `Consulta de ${currentArea.label} processada com sucesso no Protheus.`;
      if (response?.task_id) {
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 1500));
          const status = await getAgentTaskStatus(response.task_id);
          if (['completed', 'success'].includes(status.status)) {
            replyText = status.response_text || status.summary || status.answer || 'Aqui está o resultado da sua consulta no Protheus.';
            break;
          }
          if (status.status === 'execution_failed') {
            replyText = `Erro na execução: ${status.execution_error || 'Falha na consulta Oracle.'}`;
            break;
          }
          if (['failed', 'error'].includes(status.status)) {
            replyText = `Falha na consulta: ${status.error || status.message || 'Erro na execução SQL'}`;
            break;
          }
        }
      } else if (response?.response_text) {
        replyText = response.response_text;
      }

      setCopilotMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          suggestions: ['Detalhar por filial', 'Exportar para Excel']
        }
      ]);
    } catch (err) {
      setCopilotMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Não foi possível consultar o Protheus: ${err.message || 'Erro de conexão'}`,
          suggestions: ['Tentar novamente']
        }
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f5faff] font-['Inter',sans-serif] text-[#171c20] overflow-hidden">
      {/* 1. Sidebar de Navegação por Áreas (Financeiro, Vendas, Compras, Estoque, Contabilidade) */}
      <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0 z-20">
        {/* Logo / Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004fce] flex items-center justify-center text-white font-bold text-lg shadow-md shadow-[#004fce]/20">
              ✦
            </div>
            <div>
              <div className="font-bold text-[15px] text-[#0f172a] leading-tight">Copilot Protheus</div>
              <div className="text-[11px] font-semibold text-[#004fce] tracking-wider uppercase">Executive Suite</div>
            </div>
          </div>
        </div>

        {/* Menu de Áreas Corporativas */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 pt-1">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Visões por Área</span>
          </div>

          {Object.values(AREAS_CONFIG).map(area => {
            const Icon = area.icon;
            const isActive = activeAreaKey === area.id;
            return (
              <button
                key={area.id}
                onClick={() => setActiveAreaKey(area.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0f66ff] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#eff4f9] hover:text-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{area.label}</span>
                </div>
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {area.module}
                </span>
              </button>
            );
          })}

          <div className="pt-5 pb-1 px-3">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Espaço de Trabalho</span>
          </div>

          <button
            onClick={onNavigateToWorkspace}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-[#004fce] bg-[#e0ecff] hover:bg-[#d0e2ff] transition-all border border-[#bfd5fe] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#004fce]" />
              <span>Workspace Copilot</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center gap-2 text-[12px] text-[#475569]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
            <span className="font-medium">Oracle TOTVS Cloud</span>
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-0.5 font-mono">
            {context?.environment || 'Ambiente'} (Emp. {context?.company || '??'} / {context?.branch || '??'})
          </div>
        </div>
      </aside>

      {/* 2. Área Central do Dashboard (70%) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="bg-[#eff4f9] px-3 py-1.5 rounded-lg flex items-center gap-2 text-[#475569] text-[13px] font-medium border border-[#e2e8f0]">
              <Building2 className="w-4 h-4 text-[#004fce]" />
              <span>{context?.tenant_id ? context.tenant_id.replace('_prod', '').toUpperCase() : 'Sem Contexto'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8]" />
            </div>

            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder={`Pesquisar em ${currentArea.label}...`}
                className="w-full pl-9 pr-3 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-[13px] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#004fce]/20 focus:border-[#004fce] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToWorkspace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4f9] hover:bg-[#e2e8f0] text-[#004fce] text-xs font-semibold border border-[#e2e8f0] transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir Copilot Chat</span>
            </button>

            <div className="text-right hidden sm:block">
              <div className="text-[13px] font-bold text-[#0f172a]">Diretoria Executiva</div>
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">C-Level / {currentArea.label}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#004fce] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Conteúdo da Área Selecionada */}
        <main className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
          {/* OVERLAY DE ESTADO VAZIO */}
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-[#e2e8f0] text-center max-w-md">
              <div className="w-16 h-16 bg-[#eff4f9] rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-[#004fce]" />
              </div>
              <h2 className="text-lg font-bold text-[#0f172a] mb-2">Painel Demonstrativo</h2>
              <p className="text-[13px] text-[#475569] mb-6">
                Este dashboard visual não está atualmente conectado a uma fonte de dados real (QueryRest). Para obter análises reais, faça perguntas ao Copiloto.
              </p>
              <button
                onClick={onNavigateToWorkspace}
                className="px-5 py-2.5 bg-[#004fce] hover:bg-[#003db3] text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Ir para Workspace
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 opacity-30 pointer-events-none filter grayscale">
            {/* Título da Visão */}
            <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">{currentArea.title}</h1>
                <span className="px-2 py-0.5 rounded-md bg-[#e0ecff] text-[#004fce] text-xs font-mono font-bold">
                  {currentArea.module}
                </span>
              </div>
              <p className="text-sm text-[#64748b] mt-0.5">{currentArea.subtitle}</p>
            </div>

            <div className="flex items-center gap-2.5">
              <button className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#e2e8f0] rounded-lg text-[#475569] text-xs font-semibold hover:bg-[#f8fafc] transition-colors shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-[#004fce]" />
                <span>{period}</span>
                <ChevronDown className="w-3 h-3 text-[#94a3b8]" />
              </button>
              <button className="flex items-center gap-2 px-3.5 py-1.5 bg-[#004fce] rounded-lg text-white text-xs font-semibold hover:bg-[#003ea6] transition-all shadow-sm shadow-[#004fce]/20">
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Relatório</span>
              </button>
            </div>
          </div>

          {/* Banner da Área */}
          <div className="relative w-full h-28 rounded-2xl overflow-hidden bg-gradient-to-r from-[#004fce] via-[#0f66ff] to-[#495f82] p-6 text-white flex items-center justify-between shadow-sm">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold mb-1 backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                <span>{currentArea.bannerBadge}</span>
              </div>
              <h2 className="text-xl font-bold">{currentArea.bannerTitle}</h2>
              <p className="text-xs text-white/80">{currentArea.bannerSubtitle}</p>
            </div>
            <div className="hidden md:flex items-center gap-4 relative z-10">
              <div className="text-right">
                <div className="text-xs text-white/75">{currentArea.bannerMetricLabel}</div>
                <div className="text-xl font-bold">{currentArea.bannerMetricValue}</div>
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/10 blur-3xl rounded-full transform translate-x-12"></div>
          </div>

          {/* 4 Cards Bento de KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentArea.kpis.map((kpi, index) => {
              const KpiIcon = kpi.icon;
              if (kpi.isHighlight) {
                return (
                  <div key={index} className="bg-[#004fce] rounded-xl p-5 text-white shadow-md shadow-[#004fce]/20 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{kpi.label}</span>
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                        <KpiIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-2 relative z-10">{kpi.value}</div>
                    <div className="flex items-center gap-1.5 text-xs relative z-10">
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                        <ArrowUpRight className="w-3 h-3" /> {kpi.change}
                      </span>
                      <span className="text-white/70">vs mês anterior</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden group hover:border-[#004fce]/40 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">{kpi.label}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bgColor, color: kpi.color }}>
                      <KpiIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#0f172a] mb-2">{kpi.value}</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold ${
                        kpi.isPositive
                          ? 'bg-[#22c55e]/10 text-[#22c55e]'
                          : 'bg-[#ef4444]/10 text-[#ef4444]'
                      }`}
                    >
                      {kpi.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {kpi.change}
                    </span>
                    <span className="text-[#94a3b8]">vs mês anterior</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gráfico e Composição */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-[16px]">{currentArea.chartTitle}</h3>
                  <p className="text-xs text-[#64748b]">{currentArea.chartSubtitle}</p>
                </div>
                <div className="flex bg-[#eff4f9] rounded-lg p-1 border border-[#e2e8f0]">
                  <button
                    onClick={() => setChartView('semanal')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      chartView === 'semanal' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'
                    }`}
                  >
                    Semanal
                  </button>
                  <button
                    onClick={() => setChartView('mensal')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      chartView === 'mensal' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'
                    }`}
                  >
                    Mensal
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[240px] relative flex items-end">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                  <div className="border-b border-[#f1f5f9] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>Meta Alta</span>
                  </div>
                  <div className="border-b border-[#f1f5f9] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>Média Prevista</span>
                  </div>
                  <div className="border-b border-[#f1f5f9] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>Ponto Mínimo</span>
                  </div>
                  <div className="border-b border-[#e2e8f0] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>Zero</span>
                  </div>
                </div>

                <svg className="w-full h-full absolute inset-0 pb-6 overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#004fce" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#004fce" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0,180 Q 150,210 300,140 T 550,90 T 800,40 L 800,240 L 0,240 Z"
                    fill="url(#areaGrad)"
                  />
                  <path
                    d="M 0,180 Q 150,210 300,140 T 550,90 T 800,40"
                    fill="none"
                    stroke="#004fce"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="180" r="4" fill="#ffffff" stroke="#004fce" strokeWidth="2.5" />
                  <circle cx="300" cy="140" r="4" fill="#ffffff" stroke="#004fce" strokeWidth="2.5" />
                  <circle cx="550" cy="90" r="4" fill="#ffffff" stroke="#004fce" strokeWidth="2.5" />
                  <circle cx="800" cy="40" r="6" fill="#004fce" stroke="#ffffff" strokeWidth="2.5" />
                </svg>

                <div className="w-full flex justify-between px-2 text-[11px] font-medium text-[#64748b] z-10 pt-2">
                  <span>Semana 1</span>
                  <span>Semana 2</span>
                  <span>Semana 3</span>
                  <span>Semana 4</span>
                  <span>Fechamento</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-[#0f172a] text-[16px] mb-1">{currentArea.compositionTitle}</h3>
                <p className="text-xs text-[#64748b] mb-4">{currentArea.compositionSubtitle}</p>

                <div className="space-y-3">
                  {currentArea.compositionItems.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-[#475569]">{item.label}</span>
                        <span className="text-[#0f172a]">{item.percentage}% ({item.detail})</span>
                      </div>
                      <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                <button
                  onClick={() => handleSendCopilot(`Faça uma análise executiva da área de ${currentArea.label} no Protheus`)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#eff4f9] hover:bg-[#e2e8f0] text-[#004fce] text-xs font-bold transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analisar {currentArea.label} com IA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Dados da Área */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div>
                <h3 className="font-bold text-[#0f172a] text-[15px]">{currentArea.tableTitle}</h3>
                <p className="text-xs text-[#64748b]">{currentArea.tableSubtitle}</p>
              </div>
              <button
                onClick={() => handleSendCopilot(`Listar registros detalhados de ${currentArea.label}`)}
                className="text-xs font-semibold text-[#004fce] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Consultar no Copilot</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#64748b] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    {currentArea.tableHeaders.map((header, hIdx) => (
                      <th key={hIdx} className={`px-6 py-3 ${hIdx === currentArea.tableHeaders.length - 2 ? 'text-right' : hIdx === currentArea.tableHeaders.length - 1 ? 'text-center' : ''}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {currentArea.tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-6 py-3.5 font-medium text-[#64748b]">{row.col1}</td>
                      <td className="px-6 py-3.5 font-semibold text-[#0f172a]">{row.col2}</td>
                      <td className="px-6 py-3.5 text-[#64748b]">{row.col3}</td>
                      <td className={`px-6 py-3.5 text-right font-bold ${row.col4Class || 'text-[#0f172a]'}`}>{row.col4}</td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${row.statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* 3. Painel Lateral do Copilot IA Integrado (30%) */}
      <aside className="w-80 lg:w-96 bg-white border-l border-[#e2e8f0] flex flex-col flex-shrink-0 z-20">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004fce] flex items-center justify-center text-white shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[14px] text-[#0f172a]">Copiloto IA</div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#22c55e]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping"></span>
                <span className="font-semibold">{currentArea.label} ({currentArea.module})</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCopilotMessages([
              {
                role: 'assistant',
                text: currentArea.initialCopilotMsg,
                suggestions: currentArea.copilotSuggestions
              }
            ])}
            className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg transition-colors cursor-pointer"
            title="Reiniciar conversa"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8fafc]">
          {copilotMessages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-3.5 rounded-2xl text-[13px] leading-relaxed max-w-[90%] ${
                  msg.role === 'user'
                    ? 'bg-[#004fce] text-white rounded-br-none shadow-sm'
                    : 'bg-white text-[#171c20] border border-[#e2e8f0] rounded-bl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {msg.suggestions.map((sug, sIndex) => (
                    <button
                      key={sIndex}
                      onClick={() => handleSendCopilot(sug)}
                      className="px-2.5 py-1 rounded-full bg-white border border-[#e2e8f0] text-[11px] font-semibold text-[#004fce] hover:bg-[#e0ecff] transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#004fce]" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isCopilotLoading && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-[#e2e8f0] text-xs text-[#64748b] shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#004fce]" />
              <span>Consultando {currentArea.module} via Oracle REST...</span>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#e2e8f0] bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCopilot();
            }}
            className="relative"
          >
            <textarea
              value={copilotQuestion}
              onChange={(e) => setCopilotQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendCopilot();
                }
              }}
              placeholder={`Pergunte ao Protheus sobre ${currentArea.label}...`}
              rows={2}
              className="w-full pl-3 pr-10 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[13px] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#004fce]/20 focus:border-[#004fce] resize-none"
            />
            <button
              type="submit"
              disabled={!copilotQuestion.trim() || isCopilotLoading}
              className="absolute right-2 bottom-3 p-1.5 bg-[#004fce] text-white rounded-lg hover:bg-[#003ea6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

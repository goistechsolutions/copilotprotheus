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
import { askAgent, waitForAgentTask } from '../services/api';
import { normalizeTaskPayload, TASK_STATUS, getTaskStatusLabel } from '../services/taskStatus';

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
        change: '',
        isPositive: true,
        icon: Wallet,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Contas a Pagar (SE2)',
        value: '---',
        change: '',
        isPositive: false,
        icon: ArrowDownRight,
        color: '#ef4444',
        bgColor: '#fef2f2'
      },
      {
        label: 'Contas a Receber (SE1)',
        value: '---',
        change: '',
        isPositive: true,
        icon: ArrowUpRight,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Lucro Líquido / EBITDA',
        value: '---',
        change: '',
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
      { label: 'Folha de Pagamento', percentage: 0, detail: '---', color: '#004fce' },
      { label: 'Fornecedores / Insumos', percentage: 0, detail: '---', color: '#0f66ff' },
      { label: 'Tributário e Impostos', percentage: 0, detail: '---', color: '#f59e0b' },
      { label: 'Infraestrutura / TI', percentage: 0, detail: '---', color: '#64748b' }
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
    bannerMetricLabel: 'Meta do Mês ',
    bannerMetricValue: '---',
    kpis: [
      {
        label: 'Faturamento Acumulado',
        value: '---',
        change: '',
        isPositive: true,
        icon: TrendingUp,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Pedidos Emitidos (SC5)',
        value: '---',
        change: '',
        isPositive: true,
        icon: ShoppingBag,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Ticket Médio por Venda',
        value: '---',
        change: '',
        isPositive: true,
        icon: Tag,
        color: '#0f66ff',
        bgColor: '#f5faff'
      },
      {
        label: 'Margem Bruta Média',
        value: '---',
        change: '',
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
      { label: 'Linha Industrial / Peças', percentage: 0, detail: '---', color: '#004fce' },
      { label: 'Linha Varejo / Consumo', percentage: 0, detail: '---', color: '#0f66ff' },
      { label: 'Contratos de Serviços', percentage: 0, detail: '---', color: '#22c55e' },
      { label: 'Acessórios e Outros', percentage: 0, detail: '---', color: '#64748b' }
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
        change: '',
        isPositive: true,
        icon: ShoppingCart,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Pedidos de Compra Abertos',
        value: '---',
        change: '',
        isPositive: true,
        icon: Clock,
        color: '#f59e0b',
        bgColor: '#fefce8'
      },
      {
        label: 'Lead Time Médio',
        value: '---',
        change: '',
        isPositive: true,
        icon: Truck,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Economia em Negociações',
        value: '---',
        change: '',
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
      { label: 'Matérias-Primas', percentage: 0, detail: '---', color: '#004fce' },
      { label: 'Embalagens e Descartáveis', percentage: 0, detail: '---', color: '#0f66ff' },
      { label: 'Manutenção / MRO', percentage: 0, detail: '---', color: '#f59e0b' },
      { label: 'Serviços Terceirizados', percentage: 0, detail: '---', color: '#64748b' }
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
        change: '',
        isPositive: true,
        icon: Package,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Giro Anual do Estoque',
        value: '---',
        change: '',
        isPositive: true,
        icon: RefreshCw,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Itens em Ponto de Pedido',
        value: '---',
        change: '',
        isPositive: false,
        icon: AlertTriangle,
        color: '#f59e0b',
        bgColor: '#fefce8'
      },
      {
        label: 'Acuracidade de Inventário',
        value: '---',
        change: '',
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
      { label: 'Classe A (Alto Valor)', percentage: 0, detail: '---', color: '#004fce' },
      { label: 'Classe B (Médio Valor)', percentage: 0, detail: '---', color: '#0f66ff' },
      { label: 'Classe C (Baixo Valor)', percentage: 0, detail: '---', color: '#64748b' }
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
        change: '',
        isPositive: true,
        icon: BookOpen,
        color: '#004fce',
        bgColor: '#eff4f9'
      },
      {
        label: 'Passivo Circulante',
        value: '---',
        change: '',
        isPositive: true,
        icon: Scale,
        color: '#64748b',
        bgColor: '#f8fafc'
      },
      {
        label: 'Patrimônio Líquido',
        value: '---',
        change: '',
        isPositive: true,
        icon: Award,
        color: '#22c55e',
        bgColor: '#f0fdf4'
      },
      {
        label: 'Índice de Liquidez Corrente',
        value: '---',
        change: '',
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
      { label: 'Ativo Circulante (Disponível + Recebíveis)', percentage: 0, detail: '---', color: '#004fce' },
      { label: 'Ativo Não Circulante (Imobilizado / Intangível)', percentage: 0, detail: '---', color: '#0f66ff' }
    ],
    tableTitle: 'Lançamentos Contábeis Recentes',
    tableSubtitle: 'Lote contábil ativo no Protheus (CT2 / CT1)',
    tableHeaders: ['Data / Lote', 'Conta Débito / Crédito', 'Histórico do Lançamento', 'Valor', 'Status'],
    tableRows: [],
    initialCopilotMsg: 'Olá! O fechamento contábil preliminar deste mês aponta um EBITDA de 22.4% e índice de liquidez de 2.42x. Deseja visualizar o DRE consolidado?',
    copilotSuggestions: ['DRE consolidado', 'Balancete do mês', 'Lançamentos manuais']
  }
};


function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  if (!/^[+-]?\s*(?:R\$\s*)?\d[\d\s.,]*(?:%|\s*)$/.test(candidate)) return null;
  const normalized = candidate.replace(/\s/g, '').replace(/\.(?=\d{3}(?:,|$))/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(val) {
  if (typeof val === 'number') {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return String(val);
}

const SALES_PANELS = [
  {
    id: 'overview',
    label: 'Análise de vendas',
    title: 'Análise de vendas',
    subtitle: 'Visão consolidada do faturamento e dos registros retornados pelo Protheus.',
    groupPatterns: ['DATA', 'EMISSAO', 'MES', 'PERIODO'],
  },
  {
    id: 'seller',
    label: 'Por vendedor',
    title: 'Análise de vendas por vendedor',
    subtitle: 'Agrupamento por vendedor somente quando esse campo existir no resultado autorizado.',
    groupPatterns: ['VENDEDOR', 'VENDEDOR1', 'NOME_VEND', 'A3_NOME', 'CODVEND'],
  },
  {
    id: 'product',
    label: 'Por produtos',
    title: 'Análise de vendas por produtos',
    subtitle: 'Agrupamento por produto somente quando esse campo existir no resultado autorizado.',
    groupPatterns: ['PRODUTO', 'DESCR_PROD', 'B1_DESC', 'CODPROD', 'ITEM'],
  },
];

function findColumn(columns, patterns) {
  return columns.find(column => patterns.some(pattern => String(column).toUpperCase().includes(pattern)));
}

function buildGroupedRows(rows, columns, patterns) {
  const groupColumn = findColumn(columns, patterns);
  const numericColumn = findColumn(columns, ['VALOR', 'TOTAL', 'FATUR', 'VLR', 'PRECO', 'QUANT']);
  if (!groupColumn || !numericColumn) return { rows: [], columns: [] };
  const groups = new Map();
  rows.forEach(row => {
    const label = String(row[groupColumn] ?? '').trim();
    const value = parseNumeric(row[numericColumn]);
    if (!label || value === null) return;
    groups.set(label, (groups.get(label) || 0) + value);
  });
  if (!groups.size) return { rows: [], columns: [] };
  return {
    rows: Array.from(groups.entries()).map(([label, value]) => ({ [groupColumn]: label, [numericColumn]: value })),
    columns: [groupColumn, numericColumn],
  };
}

export default function ExecutiveDashboard({ initialArea, onNavigateToWorkspace, context, initialData }) {
  const [activeAreaKey, setActiveAreaKey] = useState(initialArea || 'financeiro');
  const [activeSalesPanel, setActiveSalesPanel] = useState('overview');
  const [period, setPeriod] = useState('Mês Atual');
  const [chartView, setChartView] = useState('semanal');
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [realData, setRealData] = useState(initialData || null);

  useEffect(() => {
    if (initialData) setRealData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (initialArea && AREAS_CONFIG[initialArea]) {
      setActiveAreaKey(initialArea);
    }
  }, [initialArea]);

  const currentArea = AREAS_CONFIG[activeAreaKey] || AREAS_CONFIG.financeiro;
  const salesView = SALES_PANELS.find(panel => panel.id === activeSalesPanel) || SALES_PANELS[0];

  const dynamicRows = React.useMemo(() => {
    const r = realData?.result || realData || {};
    return Array.isArray(r.rows) ? r.rows : [];
  }, [realData]);
  const dynamicColumns = React.useMemo(() => {
    const r = realData?.result || realData || {};
    if (Array.isArray(r.columns) && r.columns.length > 0) {
      return r.columns;
    }
    if (dynamicRows.length > 0) return Object.keys(dynamicRows[0]);
    return [];
  }, [realData, dynamicRows]);
  const hasRealData = dynamicRows.length > 0;
  const groupedSales = React.useMemo(
    () => buildGroupedRows(dynamicRows, dynamicColumns, salesView.groupPatterns),
    [dynamicRows, dynamicColumns, salesView.groupPatterns],
  );
  const panelRows = activeAreaKey === 'vendas' && activeSalesPanel !== 'overview' && groupedSales.rows.length
    ? groupedSales.rows
    : dynamicRows;
  const panelColumns = activeAreaKey === 'vendas' && activeSalesPanel !== 'overview' && groupedSales.columns.length
    ? groupedSales.columns
    : dynamicColumns;

  const stats = React.useMemo(() => {
    if (!panelRows.length || !panelColumns.length) return null;
    let numericCol = null;
    let labelCol = null;
    for (const col of panelColumns) {
      const lower = col.toLowerCase();
      if (!numericCol && (lower.includes('valor') || lower.includes('total') || lower.includes('preco') || lower.includes('fat') || lower.includes('saldo'))) numericCol = col;
      if (!labelCol && (lower.includes('mes') || lower.includes('data') || lower.includes('desc') || lower.includes('nome') || lower.includes('cliente') || lower.includes('produto'))) labelCol = col;
    }
    if (!numericCol) {
      for (const col of panelColumns) {
        if (panelRows.some(r => typeof parseNumeric(r[col]) === 'number')) {
          numericCol = col;
          break;
        }
      }
    }
    if (!labelCol && panelColumns.length > 0) {
      labelCol = panelColumns[0] !== numericCol ? panelColumns[0] : (panelColumns[1] || panelColumns[0]);
    }
    if (!numericCol) return null;
    let sum = 0;
    let count = 0;
    let maxVal = -Infinity;
    let maxRow = null;
    panelRows.forEach(r => {
      const val = parseNumeric(r[numericCol]);
      if (val !== null) {
        sum += val;
        count++;
        if (val > maxVal) { maxVal = val; maxRow = r; }
      }
    });
    const avg = count > 0 ? sum / count : 0;
    const maxLabel = maxRow ? String(maxRow[labelCol] || '') : '';
    return { numericCol, labelCol, total: sum, average: avg, maxVal, maxLabel, count };
  }, [panelRows, panelColumns]);



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
      
      const payload = {
        prompt: question,
        tenant_id: context.tenant_id,
        environment_code: context.environment,
        empresa: context.company,
        filial: context.branch,
        module: currentArea.module,
        conversation_id: `dash-${activeAreaKey}-${Date.now()}`,
        execute: true,
      };
      
      const accepted = normalizeTaskPayload(await askAgent(payload));
      const finalTask = accepted.taskId 
        ? await waitForAgentTask(accepted.taskId) 
        : accepted;
        
      let replyText = `Consulta de ${currentArea.label} processada com sucesso no Protheus.`;
      
      if (finalTask.status === TASK_STATUS.SUCCESS) {
        replyText = finalTask.message || 'Aqui está o resultado da sua consulta no Protheus.';
        setRealData(finalTask.result || finalTask);
      } else if (finalTask.status === TASK_STATUS.FAILED) {
        replyText = `Erro na execução: ${finalTask.error || 'Falha na consulta Oracle.'}`;
      } else {
        replyText = `Consulta não concluída: ${getTaskStatusLabel(finalTask.status)}`;
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
      {/* 1. Sidebar ocultada pois o painel deve focar apenas no resultado */}
      <aside className="hidden">
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
            
            {/* Logo / Brand */}
            <div className="flex items-center gap-3 pr-4 border-r border-[#e2e8f0]">
              <div className="w-8 h-8 rounded-lg bg-[#004fce] flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-[14px] text-[#0f172a] leading-tight">Copilot Protheus</div>
                <div className="text-[10px] font-semibold text-[#004fce] tracking-wider uppercase">Painel Executivo</div>
              </div>
            </div>

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

        {activeAreaKey === 'vendas' && (
          <div className="px-6 pt-4 bg-[#f8fafc]">
            <div className="flex flex-wrap gap-2 p-1 bg-white border border-[#e2e8f0] rounded-xl shadow-sm w-fit">
              {SALES_PANELS.map(panel => (
                <button key={panel.id} type="button" onClick={() => setActiveSalesPanel(panel.id)} className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeSalesPanel === panel.id ? 'bg-[#004fce] text-white shadow-sm' : 'text-[#64748b] hover:bg-[#eff4f9] hover:text-[#0f172a]'}`}>
                  {panel.label}
                </button>
              ))}
            </div>
          </div>
        )}

          {/* Conteúdo da Área Selecionada */}
          <main className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
            {!hasRealData ? (
              <div className="absolute inset-0 z-10 bg-[#f8fafc] flex flex-col items-center justify-center p-8">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-[#e2e8f0] text-center max-w-md">
                  <div className="w-16 h-16 bg-[#eff4f9] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Database className="w-8 h-8 text-[#004fce]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#0f172a] mb-2">Painel sem dados</h2>
                  <p className="text-[13px] text-[#475569] mb-6">
                    Os indicadores desta área serão exibidos após uma consulta válida ao Protheus.
                  </p>
                  <button
                    onClick={onNavigateToWorkspace}
                    className="px-5 py-2.5 bg-[#004fce] hover:bg-[#003db3] text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Abrir Copilot Chat
                  </button>
                </div>
              </div>
            ) : (
            <div className="p-6 space-y-6">
            {/* Título da Visão */}
            <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">{activeAreaKey === 'vendas' ? salesView.title : currentArea.title}</h1>
                <span className="px-2 py-0.5 rounded-md bg-[#e0ecff] text-[#004fce] text-xs font-mono font-bold">
                  {currentArea.module}
                </span>
              </div>
              <p className="text-sm text-[#64748b] mt-0.5">{activeAreaKey === 'vendas' ? salesView.subtitle : currentArea.subtitle}</p>
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
            {hasRealData && stats ? (
              <>
                <div className="bg-[#004fce] rounded-xl p-5 text-white shadow-md shadow-[#004fce]/20 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{stats.numericCol || 'TOTAL'}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2 relative z-10">{formatCurrency(stats.total)}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Média</span>
                  </div>
                  <div className="text-2xl font-bold text-[#0f172a] mb-2 relative z-10">{formatCurrency(stats.average)}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Pico {stats.maxLabel ? '(' + stats.maxLabel + ')' : ''}</span>
                  </div>
                  <div className="text-2xl font-bold text-[#0f172a] mb-2 relative z-10">{stats.maxVal !== -Infinity ? formatCurrency(stats.maxVal) : '---'}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Registros</span>
                  </div>
                  <div className="text-2xl font-bold text-[#0f172a] mb-2 relative z-10">{panelRows.length}</div>
                </div>
              </>
            ) : currentArea.kpis.map((kpi, index) => {
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
                  <h3 className="font-bold text-[#0f172a] text-[16px]">{activeAreaKey === 'vendas' ? salesView.title : currentArea.chartTitle}</h3>
                  <p className="text-xs text-[#64748b]">{activeAreaKey === 'vendas' ? salesView.subtitle : currentArea.chartSubtitle}</p>
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
                <h3 className="font-bold text-[#0f172a] text-[16px] mb-1">{activeAreaKey === 'vendas' ? salesView.title : currentArea.compositionTitle}</h3>
                <p className="text-xs text-[#64748b] mb-4">{activeAreaKey === 'vendas' ? salesView.subtitle : currentArea.compositionSubtitle}</p>

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
                <h3 className="font-bold text-[#0f172a] text-[15px]">{hasRealData ? ((realData?.result?.summary || realData?.summary || (activeAreaKey === 'vendas' ? salesView.title : currentArea.tableTitle))) : (activeAreaKey === 'vendas' ? salesView.title : currentArea.tableTitle)}</h3>
                <p className="text-xs text-[#64748b]">{hasRealData ? "Dados retornados pelo Protheus" : currentArea.tableSubtitle}</p>
              </div>
              <button
                onClick={() => onNavigateToWorkspace(activeAreaKey)}
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
                    {(hasRealData ? panelColumns : currentArea.tableHeaders).map((header, hIdx) => (
                      <th key={hIdx} className="px-6 py-3 text-left">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {!hasRealData ? currentArea.tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-6 py-3.5 font-medium text-[#64748b]">{row.col1}</td>
                      <td className="px-6 py-3.5 font-semibold text-[#0f172a]">{row.col2}</td>
                      <td className="px-6 py-3.5 text-[#64748b]">{row.col3}</td>
                      <td className={`px-6 py-3.5 text-right font-bold ${row.col4Class || 'text-[#0f172a]'}`}>{row.col4}</td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${row.statusClass}`}>{row.status}</span>
                      </td>
                    </tr>
                  )) : panelRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#f8fafc] transition-colors">
                      {panelColumns.map((col, cIdx) => {
                        const val = row[col];
                        const isNum = typeof val === 'number';
                        return (
                          <td key={cIdx} className={`px-6 py-3.5 ${isNum ? 'text-right font-semibold text-[#0f172a]' : 'text-[#64748b]'}`}>
                            {isNum ? formatCurrency(val) : String(val ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            </div>
            )}
          </main>
      </div>

      
    </div>
  );
}

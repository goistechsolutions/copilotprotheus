import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ExecutiveDomain,
  CompanyEntity,
  CompanyBranch,
  ExecutiveKpi,
  ExecutiveInsight,
  CopilotMessage,
} from '../types/executive';
import {
  COMPANIES_DATA,
  EXECUTIVE_KPIS,
  STRATEGIC_INSIGHTS,
} from '../data/executiveData';

interface ExecutiveContextType {
  // Theme
  isDark: boolean;
  toggleTheme: () => void;

  // Organization & Scope
  companies: CompanyEntity[];
  selectedCompany: CompanyEntity;
  setSelectedCompany: (company: CompanyEntity) => void;
  selectedBranch: CompanyBranch;
  setSelectedBranch: (branch: CompanyBranch) => void;

  // Domain & Filters
  activeDomain: ExecutiveDomain;
  setActiveDomain: (domain: ExecutiveDomain) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  comparisonMode: 'previous' | 'budget';
  setComparisonMode: (mode: 'previous' | 'budget') => void;

  // Active Metrics
  kpis: ExecutiveKpi[];
  insights: ExecutiveInsight[];

  // Scenario Simulator
  simulationPriceDelta: number;
  setSimulationPriceDelta: (val: number) => void;
  simulationDelinquencyDelta: number;
  setSimulationDelinquencyDelta: (val: number) => void;
  simulationCostDelta: number;
  setSimulationCostDelta: (val: number) => void;
  simulatedEbitdaImpact: { amount: number; marginDelta: number; formatted: string };

  // Copilot Chat
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  messages: CopilotMessage[];
  isThinking: boolean;
  currentReasoningStep: string | null;
  activeReasoningSteps: string[];
  sendMessage: (query: string) => Promise<void>;
  clearChat: () => void;

  // Modals & Tools
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  selectedInsightForDetail: ExecutiveInsight | null;
  setSelectedInsightForDetail: (insight: ExecutiveInsight | null) => void;
}

const ExecutiveContext = createContext<ExecutiveContextType | undefined>(undefined);

const INITIAL_MESSAGES: CopilotMessage[] = [
  {
    id: 'msg-01',
    role: 'assistant',
    text: 'Olá! Sou o **Protheus Copiloto Executivo**, seu assistente de inteligência estratégica conectado ao ERP TOTVS Protheus.\n\nTodos os painéis ao lado refletem dados contábeis, fiscais, de faturamento e almoxarifado em tempo real com **garantia estrita de leitura e zero alucinação**.',
    timestamp: '09:00',
    protheusTables: ['SF2010', 'SD2010', 'SE1010', 'SE2010', 'SB2010', 'CT2010'],
    kpis: [
      { label: 'Receita MTD', value: 'R$ 28,45M', color: '#0F66FF' },
      { label: 'Margem EBITDA', value: '27,0%', color: '#22C55E' },
      { label: 'Fluxo 30d', value: 'R$ 12,42M', color: '#06B6D4' },
      { label: 'Inadimplência', value: '2,1%', color: '#F59E0B' },
    ],
    suggestedQuestions: [
      'Qual filial teve a maior margem EBITDA este mês?',
      'Identificar clientes com risco de crédito ou atrasos na SE1',
      'Quais produtos têm risco de ruptura de estoque no almoxarifado?',
      'Simular impacto de aumento de 3% no preço de bombas hidráulicas',
    ],
  },
];

export const ExecutiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('protheus_exec_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('protheus_exec_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('protheus_exec_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Companies & Branches
  const [companies] = useState<CompanyEntity[]>(COMPANIES_DATA);
  const [selectedCompany, setSelectedCompany] = useState<CompanyEntity>(COMPANIES_DATA[0]);
  const [selectedBranch, setSelectedBranch] = useState<CompanyBranch>(COMPANIES_DATA[0].branches[0]);

  // Filters & Domains
  const [activeDomain, setActiveDomain] = useState<ExecutiveDomain>('overview');
  const [timeRange, setTimeRange] = useState<string>('MTD (Agosto 2026)');
  const [comparisonMode, setComparisonMode] = useState<'previous' | 'budget'>('previous');

  // Modals & Panels
  const [copilotOpen, setCopilotOpen] = useState<boolean>(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [selectedInsightForDetail, setSelectedInsightForDetail] = useState<ExecutiveInsight | null>(null);

  // Scenario Simulator
  const [simulationPriceDelta, setSimulationPriceDelta] = useState<number>(0);
  const [simulationDelinquencyDelta, setSimulationDelinquencyDelta] = useState<number>(0);
  const [simulationCostDelta, setSimulationCostDelta] = useState<number>(0);

  // Simulated calculations for What-If
  const baseRevenue = 28450000;
  const priceImpact = baseRevenue * (simulationPriceDelta / 100);
  const costImpact = -(baseRevenue * 0.58) * (simulationCostDelta / 100);
  const delinquencyImpact = -(baseRevenue * 0.02) * (simulationDelinquencyDelta / 100);
  const totalEbitdaDelta = priceImpact + costImpact + delinquencyImpact;
  const newMarginDelta = Number(((totalEbitdaDelta / baseRevenue) * 100).toFixed(2));

  const simulatedEbitdaImpact = {
    amount: totalEbitdaDelta,
    marginDelta: newMarginDelta,
    formatted: (totalEbitdaDelta >= 0 ? '+ R$ ' : '- R$ ') + Math.abs(totalEbitdaDelta / 1000).toFixed(0) + 'k',
  };

  // Keyboard shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // KPIs & Insights based on active domain
  const kpis = EXECUTIVE_KPIS[activeDomain] || EXECUTIVE_KPIS['overview'];
  const insights = STRATEGIC_INSIGHTS;

  // Copilot Chat State
  const [messages, setMessages] = useState<CopilotMessage[]>(INITIAL_MESSAGES);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [currentReasoningStep, setCurrentReasoningStep] = useState<string | null>(null);
  const [activeReasoningSteps, setActiveReasoningSteps] = useState<string[]>([]);

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  const sendMessage = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsgId = 'usr-' + Date.now();
    const newUserMsg: CopilotMessage = {
      id: userMsgId,
      role: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsThinking(true);
    setActiveReasoningSteps([]);

    // Multi-step reasoning pipeline simulation
    const steps = [
      'Consultando dicionário Protheus SX2/SX3 para mapeamento de chaves...',
      'Verificando regras de Query Guard & permissões de leitura do tenant...',
      'Executando query segura via QueryRest em AppServer TOTVS...',
      'Consolidando balanço, margem EBITDA e índices executivos...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setCurrentReasoningStep(steps[i]);
      setActiveReasoningSteps(prev => [...prev, steps[i]]);
      await new Promise(res => setTimeout(res, 450));
    }

    // Generate specialized executive response based on prompt context
    let replyText = '';
    let sqlSnippet = '';
    let protheusTables: string[] = ['SF2010', 'SD2010'];
    let kpiHighlights: { label: string; value: string; color: string }[] = [];
    let suggested: string[] = [];

    const lower = queryText.toLowerCase();

    if (lower.includes('filial') || lower.includes('unidade') || lower.includes('comparar')) {
      replyText = `### Análise Comparativa de Filiais (MTD)

A **Filial 01 (Matriz Centro SP)** lidera a geração de valor, respondendo por **53,4% da receita total** e margem EBITDA de **27,0%**.

1. **Filial 01 (Matriz SP)**: Receita **R$ 15,20M** | EBITDA **R$ 4,10M** (Margem 27,0%)
2. **Filial 02 (Campinas)**: Receita **R$ 7,85M** | EBITDA **R$ 2,15M** (Margem 27,4%)
3. **Filial 03 (Santos)**: Receita **R$ 5,40M** | EBITDA **R$ 1,43M** (Margem 26,5%)

**Destaque Executivo:** A Filial Campinas apresentou a maior eficiência operacional (+40 bps acima da matriz) devido à proximidade do centro logístico.`;
      sqlSnippet = `SELECT F2_FILIAL, SUM(F2_VALBRUT) AS TOTAL_FAT, SUM(F2_VALMERC) AS TOTAL_LIQ 
FROM SF2010 
WHERE D_E_L_E_T_ = ' ' AND F2_EMISSAO BETWEEN '20260801' AND '20260831' 
GROUP BY F2_FILIAL 
ORDER BY TOTAL_FAT DESC;`;
      protheusTables = ['SF2010', 'SD2010', 'CT2010'];
      kpiHighlights = [
        { label: 'Matriz SP', value: 'R$ 15,20M', color: '#0F66FF' },
        { label: 'Campinas Fabril', value: 'R$ 7,85M', color: '#10B981' },
        { label: 'Santos Portuária', value: 'R$ 5,40M', color: '#F59E0B' },
      ];
      suggested = [
        'Qual o mix de produtos mais rentável da Filial Campinas?',
        'Exportar balancete consolidado das 3 filiais em Excel',
      ];
    } else if (lower.includes('risco') || lower.includes('crédito') || lower.includes('inadimpl')) {
      replyText = `### Diagnóstico de Crédito & Inadimplência (SE1010)

A taxa de inadimplência da carteira está em **2,1%**, classificada como **excelente** perante o benchmark do setor (< 3,5%).

**Contas com Atenção Imediata:**
- **Metalúrgica Paulista S/A (CLI-0041)**: R$ 24.100,00 vencidos há 38 dias (82,4% do limite tomado). *Recomendado: manter bloqueio de pedidos no SIGAFAT.*
- **Construtora Vale do Sol (CLI-0078)**: R$ 12.800,00 em atraso (19 dias médios).

**Títulos a Vencer nos Próximos 7 Dias:** R$ 4.280.000,00 (100% de previsão de adimplência pelas contas corporativas A).`;
      sqlSnippet = `SELECT E1_CLIENTE, E1_LOJA, A1_NOME, SUM(E1_VALOR) AS SALDO_ABERTO, SUM(CASE WHEN E1_VENCREA < '20260831' THEN E1_VALOR ELSE 0 END) AS VENCIDO 
FROM SE1010 E1 
INNER JOIN SA1010 A1 ON A1.A1_COD = E1.E1_CLIENTE AND A1.A1_LOJA = E1.E1_LOJA 
WHERE E1.D_E_L_E_T_ = ' ' AND E1_SALDO > 0 
GROUP BY E1_CLIENTE, E1_LOJA, A1_NOME 
ORDER BY VENCIDO DESC;`;
      protheusTables = ['SE1010', 'SA1010'];
      kpiHighlights = [
        { label: 'Inadimplência Geral', value: '2,1%', color: '#22C55E' },
        { label: 'SE1 em Atraso', value: 'R$ 397k', color: '#EF4444' },
        { label: 'DSO Médio', value: '38,4 dias', color: '#0F66FF' },
      ];
      suggested = [
        'Ver histórico de pagamentos da Metalúrgica Paulista',
        'Simular impacto se a taxa de inadimplência subir 1,5%',
      ];
    } else if (lower.includes('estoque') || lower.includes('ruptura') || lower.includes('sb2') || lower.includes('almoxarifado')) {
      replyText = `### Análise de Giro & Saúde de Estoque (SB1/SB2)

O valor total imobilizado em estoque está em **R$ 14,85M** com giro de **11,4x ao ano** (32 dias de cobertura média).

**Itens em Ponto Crítico de Ressuprimento:**
- **Válvula Esfera Inox 316 2 Pol (PROD-00450)**: Saldo de 122 un (cobertura de 14 dias vs lead time de 18 dias do fornecedor).
- **Motor Elétrico 15CV (PROD-00789)**: Saldo de 48 un na Filial Campinas (cobertura de 19 dias).

**Itens em Obsolescência (> 90 dias sem giro):** Total de R$ 480k, com redução de 41,5% após a campanha de liquidação.`;
      sqlSnippet = `SELECT B2_COD, B1_DESC, B2_LOCAL, B2_QATU, B2_VATU1, (B2_VATU1 / NULLIF(B2_QATU, 0)) AS CUSTO_MEDIO 
FROM SB2010 B2 
INNER JOIN SB1010 B1 ON B1.B1_COD = B2.B2_COD 
WHERE B2.D_E_L_E_T_ = ' ' AND B2_QATU > 0 
ORDER BY B2_VATU1 DESC;`;
      protheusTables = ['SB1010', 'SB2010', 'SD3010'];
      kpiHighlights = [
        { label: 'Estoque SB2', value: 'R$ 14,85M', color: '#0F66FF' },
        { label: 'Giro Anual', value: '11,4x', color: '#22C55E' },
        { label: 'Itens em Ruptura', value: '2 produtos', color: '#EF4444' },
      ];
      suggested = [
        'Gerar pedido de compras sugerido para a Válvula Inox 316',
        'Ver curva ABC completa de produtos em estoque',
      ];
    } else {
      replyText = `### Síntese Executiva de Desempenho

Com base nos registros integrados do ERP TOTVS Protheus para **${selectedCompany.name} (${selectedBranch.name})**:

- **Faturamento Bruto:** **R$ 28,45M** (+12% vs período anterior)
- **EBITDA:** **R$ 7,68M** (Margem saudável de 27,0%)
- **Posição de Caixa Líquida:** **R$ 12,42M** com liquidez imediata para despesas operacionais dos próximos 74 dias.
- **Conformidade Operacional:** Todos os módulos (SIGAFAT, SIGAFIN, SIGAEST, SIGACTB) encontram-se 100% conciliados e sem inconformidades de alçadas pendentes.`;
      sqlSnippet = `SELECT 'FATURAMENTO' AS TIPO, SUM(F2_VALBRUT) AS VALOR FROM SF2010 WHERE D_E_L_E_T_ = ' ' AND F2_EMISSAO >= '20260801'
UNION ALL 
SELECT 'CONTAS_RECEBER', SUM(E1_SALDO) FROM SE1010 WHERE D_E_L_E_T_ = ' ' AND E1_SALDO > 0
UNION ALL 
SELECT 'ESTOQUE_TOTAL', SUM(B2_VATU1) FROM SB2010 WHERE D_E_L_E_T_ = ' ';`;
      protheusTables = ['SF2010', 'SE1010', 'SE2010', 'SB2010', 'CT2010'];
      kpiHighlights = [
        { label: 'Receita Bruta', value: 'R$ 28,45M', color: '#0F66FF' },
        { label: 'EBITDA', value: 'R$ 7,68M', color: '#22C55E' },
        { label: 'Caixa Projetado', value: 'R$ 12,42M', color: '#06B6D4' },
      ];
      suggested = [
        'Analisar comportamento das despesas operacionais no SIGACTB',
        'Comparar faturamento de agosto com o orçamento anual',
      ];
    }

    const assistantMsg: CopilotMessage = {
      id: 'ast-' + Date.now(),
      role: 'assistant',
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reasoningSteps: steps,
      sqlQuery: sqlSnippet,
      protheusTables,
      kpis: kpiHighlights,
      suggestedQuestions: suggested,
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsThinking(false);
    setCurrentReasoningStep(null);
  };

  return (
    <ExecutiveContext.Provider
      value={{
        isDark,
        toggleTheme,
        companies,
        selectedCompany,
        setSelectedCompany,
        selectedBranch,
        setSelectedBranch,
        activeDomain,
        setActiveDomain,
        timeRange,
        setTimeRange,
        comparisonMode,
        setComparisonMode,
        kpis,
        insights,
        simulationPriceDelta,
        setSimulationPriceDelta,
        simulationDelinquencyDelta,
        setSimulationDelinquencyDelta,
        simulationCostDelta,
        setSimulationCostDelta,
        simulatedEbitdaImpact,
        copilotOpen,
        setCopilotOpen,
        messages,
        isThinking,
        currentReasoningStep,
        activeReasoningSteps,
        sendMessage,
        clearChat,
        commandPaletteOpen,
        setCommandPaletteOpen,
        exportModalOpen,
        setExportModalOpen,
        selectedInsightForDetail,
        setSelectedInsightForDetail,
      }}
    >
      {children}
    </ExecutiveContext.Provider>
  );
};

export const useExecutive = () => {
  const context = useContext(ExecutiveContext);
  if (!context) {
    throw new Error('useExecutive must be used within an ExecutiveProvider');
  }
  return context;
};

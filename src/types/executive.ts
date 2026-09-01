export type KPIStatus = 'positive' | 'warning' | 'danger' | 'info';
export type InsightType = 'opportunity' | 'alert' | 'critical' | 'information';
export type InsightPriority = 'high' | 'medium' | 'critical';
export type ExecutiveDomain = 'overview' | 'financial' | 'commercial' | 'inventory' | 'risk';

export interface ExecutiveKpi {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  previousValue: number;
  formattedValue: string;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
  status: KPIStatus;
  formatType: 'currency' | 'percent' | 'number';
  sparkline: number[];
  category: string;
  protheusTable: string;
  comparisonLabel: string;
  description: string;
}

export interface ExecutiveInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  businessImpact: string;
  confidenceScore: number; // e.g. 98.5
  priority: InsightPriority;
  category: string;
  protheusSource: string;
  recommendation: string;
  estimatedValue?: string;
  date: string;
}

export interface FinancialMetric {
  period: string;
  receitaBruta: number;
  receitaLiquida: number;
  custos: number;
  ebitda: number;
  margemEbitda: number;
  fluxoCaixa: number;
  inadimplencia: number;
}

export interface ProductPerformance {
  code: string;
  description: string;
  category: string;
  revenue: number;
  unitsSold: number;
  avgMargin: number;
  stockBalance: number;
  stockTurnoverDays: number;
  status: 'Alta Demanda' | 'Estoque Crítico' | 'Margem Saudável' | 'Excesso de Saldo';
  branch: string;
}

export interface ClientRiskScore {
  code: string;
  name: string;
  cnpj: string;
  creditLimit: number;
  openBalance: number;
  overdue30d: number;
  riskRating: 'A (Baixo)' | 'B (Monitorar)' | 'C (Crítico)' | 'D (Inadimplente)';
  avgDelayDays: number;
  lastPurchaseDate: string;
  status: 'Liberado' | 'Em Alerta' | 'Bloqueio Preventivo';
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  reasoningSteps?: string[];
  sqlQuery?: string;
  protheusTables?: string[];
  kpis?: { label: string; value: string; color: string }[];
  suggestedQuestions?: string[];
  dataPayload?: any;
}

export interface CompanyBranch {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  revenueMtd: number;
  ebitdaMtd: number;
  healthScore: number;
}

export interface CompanyEntity {
  id: string;
  code: string;
  name: string;
  cnpj: string;
  branches: CompanyBranch[];
}

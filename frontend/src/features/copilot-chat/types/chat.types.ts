/**
 * Tipos e Contratos do Copilot Chat Minimal
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'processing' | 'done' | 'error';

export interface FollowUpSuggestion {
  id: string;
  label: string;
  prompt: string;
}

export interface CopilotDashboardReference {
  id: string;
  title: string;
  originPrompt: string;
  screenType?: string;
  updatedAt?: string;
  payload?: any;
  kpis?: Array<{ label: string; value: string | number; change?: string; tone?: string; highlight_text?: string; format?: string }>;
  insights?: any[];
  sql_query?: string;
  rows?: any[];
  columns?: string[];
  series?: Array<{ id: string; label: string; dimension: string; measure: string; points: Array<{ label: string; value: number }> }>;
  applied_filters?: Array<{ label: string; value: string }>;
  action_buttons?: Array<{ label: string; routine?: string; action?: string; type?: string }>;
  backend_kpis?: any;
  backend_insights?: any[];
  summary?: string;
}

export interface AnalysisSummary {
  headline: string;
  keyPoints: string[];
  dashboardId?: string;
  dashboard?: CopilotDashboardReference;
}

export interface CopilotMessage {
  id: string;
  clientMessageId?: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  timestamp: string;
  dashboard?: CopilotDashboardReference | null;
  suggestions?: string[];
  errorCode?: string;
  errorDetail?: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  messageCount?: number;
  lastMessage?: string;
}

export interface CopilotSessionContext {
  tenantId?: string;
  userId?: string;
  company?: string;
  branch?: string;
  environment?: string;
  module?: string;
  currentModule?: string;
  isAuthenticated?: boolean;
}

export interface OpenDashboardDetail {
  conversationId: string;
  messageId: string;
  dashboardId: string;
  dashboard?: CopilotDashboardReference;
}

export interface AnalysisContext {
  analysisId: string;
  presentation?: any;
}

export interface DashboardReference {
  dashboardId: string;
  analysisId: string;
  title: string;
  updatedAt?: string;
  payload?: any;
}

export interface TurnResponse {
  turnId: string;
  content: string;
  analysisId?: string;
  dashboardId?: string;
  presentation?: any;
  suggestions?: string[];
}

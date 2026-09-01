export interface ProtheusContext {
  tenant_id: string;
  company: string;
  branch: string;
  user: string;
  profile: string;
  session_id: string;
  environment: string;
  module: string;
}

export interface KpiMetric {
  label: string;
  value: string | number;
  color?: 'green' | 'blue' | 'yellow' | 'red';
}

export interface AgentQueryResult {
  status: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  details?: string;
  insights?: string;
  sql?: string;
  execution_error?: string;
  error?: string;
  response_time_ms?: number;
  records?: number;
  kpis?: KpiMetric[];
  structured?: {
    columns: string[];
    rows: Array<Record<string, any>>;
    total_records?: number;
  };
  entitlement?: {
    plan_code?: string;
    query_limit?: number;
    queries_used?: number;
    remaining_queries?: number;
    active_sessions?: number;
    concurrent_sessions_limit?: number;
  };
  tenant_code?: string;
  tenant_id?: string;
  environment_code?: string;
  company_id?: string;
}

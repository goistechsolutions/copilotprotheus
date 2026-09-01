import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// --- Protheus In-Memory Database & Mock Store ---

interface Tenant {
  id: string;
  name: string;
  code: string;
  environment: string;
  status: 'active' | 'inactive' | 'pending';
  plan: string;
  max_users: number;
  active_users: number;
  query_limit: number;
  queries_used: number;
  created_at: string;
}

interface Company {
  id: string;
  tenant_id: string;
  company_code: string;
  name: string;
  cnpj: string;
  state: string;
  branches: Array<{
    branch_code: string;
    name: string;
    city: string;
    state: string;
  }>;
}

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  tenant_id: string;
  status: 'active' | 'inactive';
  last_login?: string;
}

interface RagMemory {
  id: string;
  tenant_id: string;
  title: string;
  category: string;
  content: string;
  tokens: number;
  status: 'indexed' | 'pending';
  created_at: string;
}

let tenants: Tenant[] = [
  {
    id: 'ten-01',
    name: 'TOTVS Enterprise Matriz',
    code: 'TOTVS-ENTERPRISE',
    environment: 'PROD',
    status: 'active',
    plan: 'Enterprise Unlimited',
    max_users: 100,
    active_users: 42,
    query_limit: 150000,
    queries_used: 18420,
    created_at: '2025-01-10T10:00:00Z',
  },
  {
    id: 'ten-02',
    name: 'Indústrias Metalúrgicas do Sul',
    code: 'METAL-SUL',
    environment: 'PROD',
    status: 'active',
    plan: 'Professional Corporate',
    max_users: 30,
    active_users: 18,
    query_limit: 50000,
    queries_used: 6140,
    created_at: '2025-02-01T14:30:00Z',
  },
  {
    id: 'ten-03',
    name: 'AgroNegócios Brasil S/A',
    code: 'AGRO-BR',
    environment: 'HML',
    status: 'active',
    plan: 'Enterprise',
    max_users: 50,
    active_users: 12,
    query_limit: 75000,
    queries_used: 2890,
    created_at: '2025-02-15T09:15:00Z',
  },
];

let companies: Company[] = [
  {
    id: 'comp-01',
    tenant_id: 'TOTVS-ENTERPRISE',
    company_code: '01',
    name: 'Empresa Matriz SP',
    cnpj: '12.345.678/0001-90',
    state: 'SP',
    branches: [
      { branch_code: '01', name: 'Filial Principal Centro SP', city: 'São Paulo', state: 'SP' },
      { branch_code: '02', name: 'Filial Logística Campinas', city: 'Campinas', state: 'SP' },
      { branch_code: '03', name: 'Filial Portuária Santos', city: 'Santos', state: 'SP' },
    ],
  },
  {
    id: 'comp-02',
    tenant_id: 'TOTVS-ENTERPRISE',
    company_code: '02',
    name: 'Filial Regional RJ',
    cnpj: '12.345.678/0002-71',
    state: 'RJ',
    branches: [
      { branch_code: '01', name: 'Unidade Barra RJ', city: 'Rio de Janeiro', state: 'RJ' },
      { branch_code: '02', name: 'Base Operacional Macaé', city: 'Macaé', state: 'RJ' },
    ],
  },
  {
    id: 'comp-03',
    tenant_id: 'METAL-SUL',
    company_code: '01',
    name: 'Metalúrgica Paraná Matriz',
    cnpj: '98.765.432/0001-10',
    state: 'PR',
    branches: [
      { branch_code: '01', name: 'Parque Fabril Curitiba', city: 'Curitiba', state: 'PR' },
      { branch_code: '02', name: 'Centro Distribuição Joinville', city: 'Joinville', state: 'SC' },
    ],
  },
];

let users: User[] = [
  {
    id: 'usr-01',
    username: 'admin',
    name: 'Administrador Nexxus',
    email: 'admin@nexxus.protheus.com',
    role: 'superadmin',
    tenant_id: 'TOTVS-ENTERPRISE',
    status: 'active',
    last_login: new Date().toISOString(),
  },
  {
    id: 'usr-02',
    username: 'controladoria.sp',
    name: 'Mariana Silveira',
    email: 'mariana.silveira@totvs-matriz.com.br',
    role: 'finance_manager',
    tenant_id: 'TOTVS-ENTERPRISE',
    status: 'active',
    last_login: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'usr-03',
    username: 'diretor.comercial',
    name: 'Carlos Eduardo Mendes',
    email: 'carlos.mendes@totvs-matriz.com.br',
    role: 'sales_executive',
    tenant_id: 'TOTVS-ENTERPRISE',
    status: 'active',
    last_login: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'usr-04',
    username: 'auditoria.interna',
    name: 'Roberto Fagundes',
    email: 'roberto.fagundes@totvs-matriz.com.br',
    role: 'compliance_auditor',
    tenant_id: 'TOTVS-ENTERPRISE',
    status: 'active',
    last_login: new Date(Date.now() - 86400000).toISOString(),
  },
];

let ragMemories: RagMemory[] = [
  {
    id: 'rag-01',
    tenant_id: 'TOTVS-ENTERPRISE',
    title: 'Mapeamento de TES Inteligente e CFOP Fiscal',
    category: 'Regras Fiscais',
    content: 'Tabela SF4 - Tipos de Entrada e Saída. Validação de TES 501/502 para operações interestaduais com aproveitamento de ICMS e redução de base de cálculo.',
    tokens: 420,
    status: 'indexed',
    created_at: '2025-02-10T11:00:00Z',
  },
  {
    id: 'rag-02',
    tenant_id: 'TOTVS-ENTERPRISE',
    title: 'Dicionário SX3 de Campos Customizados do Faturamento (U_)',
    category: 'Dicionário SX3',
    content: 'Campos personalizados adicionados na tabela SD2: U_CANALVDA (Canal de Venda), U_MARGEML (Margem Líquida Real), U_REGIAO (Região de Venda Comercial).',
    tokens: 380,
    status: 'indexed',
    created_at: '2025-02-12T14:20:00Z',
  },
  {
    id: 'rag-03',
    tenant_id: 'TOTVS-ENTERPRISE',
    title: 'Políticas de Alçada de Pagamentos e Compras (SCR/SC7)',
    category: 'Controladoria',
    content: 'Alçadas de aprovação para pedidos de compras acima de R$ 50.000,00 exigem liberação do Diretor Financeiro via módulo SIGACOM / SIGAFIN.',
    tokens: 510,
    status: 'indexed',
    created_at: '2025-02-18T09:40:00Z',
  },
];

const auditLogs = [
  { id: 'log-1', action: 'Consulta Agent V2 Faturamento', user: 'admin', ip: '127.0.0.1', module: 'FAT', status: 'SUCCESS', time: 'Há 2 min', created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 'log-2', action: 'Sincronização de Dicionário SX2/SX3', user: 'admin', ip: '127.0.0.1', module: 'CFG', status: 'SUCCESS', time: 'Há 14 min', created_at: new Date(Date.now() - 840000).toISOString() },
  { id: 'log-3', action: 'Consulta Contas a Pagar (SE2)', user: 'controladoria.sp', ip: '192.168.1.45', module: 'FIN', status: 'SUCCESS', time: 'Há 28 min', created_at: new Date(Date.now() - 1680000).toISOString() },
  { id: 'log-4', action: 'Validação de Query Guard (Anti-Injection)', user: 'sistema', ip: '127.0.0.1', module: 'SEC', status: 'BLOCKED_SAFE', time: 'Há 45 min', created_at: new Date(Date.now() - 2700000).toISOString() },
  { id: 'log-5', action: 'Indexação RAG de Documento Fiscal', user: 'admin', ip: '127.0.0.1', module: 'RAG', status: 'SUCCESS', time: 'Há 1 hora', created_at: new Date(Date.now() - 3600000).toISOString() },
];

// --- HEALTH & STATUS ROUTES ---

app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.4.0',
    service: 'Copilot Protheus Engine',
  });
});

app.get('/api/infra/status', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: 'production',
    uptime_seconds: 432800,
    services: {
      PostgreSQL: { status: 'healthy', latency_ms: 2.4, pool: '8/20' },
      pgvector: { status: 'healthy', vector_dimensions: 1536, indexed_docs: ragMemories.length },
      'OpenAI API': { status: 'configured', model: 'gpt-4o', latency_ms: 210 },
      'FastAPI Backend': { status: 'online', port: 3000, memory_mb: 184 },
      QueryRest: { status: 'online', protocol: 'TOTVS AppServer REST', max_concurrency: 50 },
    },
  });
});

// --- AUTHENTICATION ROUTES ---

app.get('/api/admin/auth/me', (req: Request, res: Response) => {
  res.json({
    user: 'admin',
    name: 'Administrador Nexxus',
    role: 'superadmin',
    email: 'admin@nexxus.protheus.com',
    permissions: ['all'],
    tenant: 'TOTVS-ENTERPRISE',
  });
});

app.post('/api/admin/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  res.cookie('admin_token', 'mock-jwt-token-nexxus-admin-protheus', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 86400000,
  });
  res.json({
    status: 'success',
    user: username || 'admin',
    name: 'Administrador Nexxus',
    role: 'superadmin',
    token: 'mock-jwt-token-nexxus-admin-protheus',
  });
});

app.post('/api/admin/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('admin_token');
  res.json({ status: 'logged_out' });
});

// --- ADMIN DASHBOARD & METRICS ROUTES ---

app.get('/api/admin/dashboard/stats', (req: Request, res: Response) => {
  res.json({
    tenants: tenants.length,
    tenants_trend: 12.5,
    users: users.length,
    users_trend: 8.3,
    conversations_today: 184,
    conv_trend: 15.2,
    rag_documents: ragMemories.length,
    avg_response_ms: 412,
    catalog_tables: 48,
    activity_by_module: [
      { label: 'Faturamento (SIGAFAT)', mod_sigla: 'FAT', value: 84 },
      { label: 'Financeiro (SIGAFIN)', mod_sigla: 'FIN', value: 56 },
      { label: 'Estoque & Custos (SIGAEST)', mod_sigla: 'EST', value: 28 },
      { label: 'Contabilidade (SIGACTB)', mod_sigla: 'CTB', value: 14 },
      { label: 'Compras (SIGACOM)', mod_sigla: 'COM', value: 8 },
    ],
    recent_actions: auditLogs.slice(0, 6).map(log => ({
      description: `${log.user}: ${log.action} [${log.module}]`,
      action: log.action,
      time: log.time,
      created_at: log.created_at,
    })),
  });
});

// --- TENANTS CRUD ROUTES ---

app.get(['/api/admin/tenants', '/api/tenants'], (req: Request, res: Response) => {
  res.json(tenants);
});

app.post(['/api/admin/tenants', '/api/tenants'], (req: Request, res: Response) => {
  const newTenant: Tenant = {
    id: `ten-${Date.now()}`,
    name: req.body.name || 'Novo Cliente Protheus',
    code: req.body.code || `TEN-${Date.now().toString().slice(-4)}`,
    environment: req.body.environment || 'PROD',
    status: req.body.status || 'active',
    plan: req.body.plan || 'Standard',
    max_users: Number(req.body.max_users) || 10,
    active_users: 1,
    query_limit: Number(req.body.query_limit) || 10000,
    queries_used: 0,
    created_at: new Date().toISOString(),
  };
  tenants.push(newTenant);
  res.status(201).json(newTenant);
});

app.put(['/api/admin/tenants/:id', '/api/tenants/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = tenants.findIndex(t => t.id === id || t.code === id);
  if (idx >= 0) {
    tenants[idx] = { ...tenants[idx], ...req.body };
    res.json(tenants[idx]);
  } else {
    res.status(404).json({ detail: 'Tenant não encontrado' });
  }
});

app.delete(['/api/admin/tenants/:id', '/api/tenants/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  tenants = tenants.filter(t => t.id !== id && t.code !== id);
  res.json({ status: 'deleted', id });
});

// --- COMPANIES CRUD ROUTES ---

app.get(['/api/companies', '/api/admin/companies'], (req: Request, res: Response) => {
  const tenant_id = req.query.tenant_id as string;
  if (tenant_id) {
    return res.json(companies.filter(c => c.tenant_id === tenant_id));
  }
  res.json(companies);
});

app.post(['/api/companies', '/api/admin/companies'], (req: Request, res: Response) => {
  const newCompany: Company = {
    id: `comp-${Date.now()}`,
    tenant_id: req.body.tenant_id || 'TOTVS-ENTERPRISE',
    company_code: req.body.company_code || '01',
    name: req.body.name || 'Nova Empresa',
    cnpj: req.body.cnpj || '00.000.000/0001-00',
    state: req.body.state || 'SP',
    branches: req.body.branches || [
      { branch_code: '01', name: 'Filial Principal', city: 'São Paulo', state: 'SP' },
    ],
  };
  companies.push(newCompany);
  res.status(201).json(newCompany);
});

app.put(['/api/companies/:id', '/api/admin/companies/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = companies.findIndex(c => c.id === id || c.company_code === id);
  if (idx >= 0) {
    companies[idx] = { ...companies[idx], ...req.body };
    res.json(companies[idx]);
  } else {
    res.status(404).json({ detail: 'Empresa não encontrada' });
  }
});

app.delete(['/api/companies/:id', '/api/admin/companies/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  companies = companies.filter(c => c.id !== id);
  res.json({ status: 'deleted', id });
});

// --- COMPANY BRANCHES & MODULES ROUTES ---

app.post(['/api/companies/:id/branches', '/api/admin/companies/:id/branches'], (req: Request, res: Response) => {
  const { id } = req.params;
  const company = companies.find(c => c.id === id || c.company_code === id);
  if (!company) {
    return res.status(404).json({ detail: 'Empresa não encontrada' });
  }
  const newBranch = {
    branch_code: req.body.branch_code || `0${company.branches.length + 1}`,
    name: req.body.name || 'Nova Filial',
    city: req.body.city || 'São Paulo',
    state: req.body.state || 'SP',
  };
  company.branches.push(newBranch);
  res.status(201).json(newBranch);
});

app.get(['/api/companies/:id/modules', '/api/admin/companies/:id/modules'], (req: Request, res: Response) => {
  res.json([
    { module_code: 'FAT', name: 'SIGAFAT - Faturamento e Vendas', enabled: true },
    { module_code: 'FIN', name: 'SIGAFIN - Financeiro e Fluxo de Caixa', enabled: true },
    { module_code: 'EST', name: 'SIGAEST - Estoque, Custos e Almoxarifado', enabled: true },
    { module_code: 'CTB', name: 'SIGACTB - Contabilidade Gerencial', enabled: true },
    { module_code: 'COM', name: 'SIGACOM - Compras e Suprimentos', enabled: true },
    { module_code: 'FIS', name: 'SIGAFIS - Livros Fiscais e SPED', enabled: false },
    { module_code: 'PCO', name: 'SIGAPCO - Planejamento e Controle Orçamentário', enabled: false },
  ]);
});

app.get(['/api/companies/:id/modules/available', '/api/admin/companies/:id/modules/available'], (req: Request, res: Response) => {
  res.json([
    { module_code: 'FAT', name: 'SIGAFAT - Faturamento e Vendas' },
    { module_code: 'FIN', name: 'SIGAFIN - Financeiro e Fluxo de Caixa' },
    { module_code: 'EST', name: 'SIGAEST - Estoque, Custos e Almoxarifado' },
    { module_code: 'CTB', name: 'SIGACTB - Contabilidade Gerencial' },
    { module_code: 'COM', name: 'SIGACOM - Compras e Suprimentos' },
    { module_code: 'FIS', name: 'SIGAFIS - Livros Fiscais e SPED' },
    { module_code: 'PCO', name: 'SIGAPCO - Planejamento e Controle Orçamentário' },
    { module_code: 'GPE', name: 'SIGAGPE - Gestão de Pessoal e Folha' },
    { module_code: 'PCP', name: 'SIGAPCP - Planejamento e Controle de Produção' },
  ]);
});

app.post(['/api/companies/:id/modules', '/api/admin/companies/:id/modules'], (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Módulos da empresa atualizados com sucesso.',
    modules: req.body.modules || [],
  });
});

app.post(['/api/companies/:id/modules/sync', '/api/admin/companies/:id/modules/sync'], (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Módulos sincronizados com o ambiente Protheus.',
    environment: req.body.environment_code,
    synced_at: new Date().toISOString(),
  });
});

// --- USERS & ROLES ROUTES ---

app.get('/api/admin/users', (req: Request, res: Response) => {
  res.json(users);
});

app.post('/api/admin/users', (req: Request, res: Response) => {
  const newUser: User = {
    id: `usr-${Date.now()}`,
    username: req.body.username || `user_${Date.now().toString().slice(-4)}`,
    name: req.body.name || 'Novo Usuário',
    email: req.body.email || 'usuario@empresa.com.br',
    role: req.body.role || 'business_user',
    tenant_id: req.body.tenant_id || 'TOTVS-ENTERPRISE',
    status: req.body.status || 'active',
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.get('/api/admin/roles', (req: Request, res: Response) => {
  res.json([
    { id: 'role-superadmin', name: 'Super Administrador', permissions: ['*'], description: 'Acesso total de governança' },
    { id: 'role-fin', name: 'Controladoria & Finanças', permissions: ['read:SE1', 'read:SE2', 'read:CT2', 'export:excel'], description: 'Módulos SIGAFIN e SIGACTB' },
    { id: 'role-fat', name: 'Vendas & Faturamento', permissions: ['read:SD2', 'read:SF2', 'read:SA1', 'read:SB1'], description: 'Módulo SIGAFAT' },
    { id: 'role-auditor', name: 'Auditor de Compliance', permissions: ['read:logs', 'read:audit', 'read:snapshots'], description: 'Auditoria e trilhas de acesso' },
  ]);
});

// --- LICENSES & CONTRACTS ROUTES ---

app.get('/api/admin/licenses', (req: Request, res: Response) => {
  res.json([
    {
      id: 'lic-001',
      tenant_code: 'TOTVS-ENTERPRISE',
      plan_name: 'Enterprise Corporate',
      queries_monthly: 150000,
      queries_used: 18420,
      queries_remaining: 131580,
      concurrent_sessions: 25,
      active_sessions: 4,
      expires_at: '2026-12-31',
      status: 'active',
    },
    {
      id: 'lic-002',
      tenant_code: 'METAL-SUL',
      plan_name: 'Professional Protheus',
      queries_monthly: 50000,
      queries_used: 6140,
      queries_remaining: 43860,
      concurrent_sessions: 10,
      active_sessions: 2,
      expires_at: '2026-08-31',
      status: 'active',
    },
  ]);
});

// --- RAG KNOWLEDGE & MEMORIES ROUTES ---

app.get(['/api/knowledge', '/api/admin/memories'], (req: Request, res: Response) => {
  res.json(ragMemories);
});

app.post(['/api/knowledge', '/api/admin/memories'], (req: Request, res: Response) => {
  const newMemory: RagMemory = {
    id: `rag-${Date.now()}`,
    tenant_id: req.body.tenant_id || 'TOTVS-ENTERPRISE',
    title: req.body.title || 'Novo Documento de Conhecimento Protheus',
    category: req.body.category || 'Geral',
    content: req.body.content || '',
    tokens: Math.round((req.body.content || '').length / 4),
    status: 'indexed',
    created_at: new Date().toISOString(),
  };
  ragMemories.push(newMemory);
  res.status(201).json(newMemory);
});

app.delete(['/api/knowledge/:id', '/api/admin/memories/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  ragMemories = ragMemories.filter(m => m.id !== id);
  res.json({ status: 'deleted', id });
});

// --- LOGS & AUDIT ROUTES ---

app.get(['/api/admin/logs', '/api/logs'], (req: Request, res: Response) => {
  res.json(auditLogs);
});

app.get(['/api/admin/audit', '/api/audit'], (req: Request, res: Response) => {
  res.json(auditLogs);
});

// --- PROTHEUS TABLES & DICTIONARY GOVERNANCE ROUTES ---

app.get('/api/admin/tables', (req: Request, res: Response) => {
  res.json([
    { table_name: 'SD2010', description: 'Itens de Venda da NF (Faturamento)', module: 'FAT', records: 452800, authorized: true },
    { table_name: 'SF2010', description: 'Cabeçalho das NF de Saída', module: 'FAT', records: 89400, authorized: true },
    { table_name: 'SE1010', description: 'Contas a Receber (Títulos)', module: 'FIN', records: 124500, authorized: true },
    { table_name: 'SE2010', description: 'Contas a Pagar (Obrigações)', module: 'FIN', records: 64200, authorized: true },
    { table_name: 'SB1010', description: 'Cadastro Geral de Produtos', module: 'EST', records: 18900, authorized: true },
    { table_name: 'SB2010', description: 'Saldos Físico e Financeiro em Estoque', module: 'EST', records: 37800, authorized: true },
    { table_name: 'SA1010', description: 'Cadastro de Clientes', module: 'FAT', records: 8400, authorized: true },
    { table_name: 'SA2010', description: 'Cadastro de Fornecedores', module: 'COM', records: 3200, authorized: true },
    { table_name: 'CT2010', description: 'Lançamentos Contábeis do Exercício', module: 'CTB', records: 840000, authorized: true },
  ]);
});

app.get('/api/admin/dictionary', (req: Request, res: Response) => {
  res.json({
    last_sync: new Date().toISOString(),
    total_tables: 48,
    total_fields: 1420,
    protheus_release: '12.1.2410',
    appserver_version: '20.3.2.4',
    dictionary_source: 'SX2 / SX3 / SIX',
    status: 'SYNCHRONIZED',
  });
});

app.post('/api/admin/dictionary/sync', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Dicionário SX2/SX3 sincronizado com o AppServer Protheus com sucesso.',
    tables_updated: 48,
    synced_at: new Date().toISOString(),
  });
});

app.get('/api/admin/snapshots', (req: Request, res: Response) => {
  res.json([
    { id: 'snp-01', created_at: '2025-02-28T03:00:00Z', version: 'v2.4.1', tables: 48, fields: 1420, user: 'system_cron' },
    { id: 'snp-02', created_at: '2025-02-21T03:00:00Z', version: 'v2.4.0', tables: 48, fields: 1416, user: 'system_cron' },
  ]);
});

app.get('/api/admin/permissions', (req: Request, res: Response) => {
  res.json({
    allowed_tables: ['SD2010', 'SF2010', 'SE1010', 'SE2010', 'SB1010', 'SB2010', 'SA1010', 'SA2010', 'CT2010'],
    blocked_fields: ['A1_CGC', 'A2_CGC', 'E1_NUMCARTAO', 'E2_SENHA'],
    scope_by_branch: true,
  });
});

app.get('/api/admin/query-guard', (req: Request, res: Response) => {
  res.json({
    guard_active: true,
    sql_injection_protection: 'ENABLED',
    drop_alter_protection: 'ENABLED',
    dml_blocked: 'ENABLED (Only SELECT / QueryRest allowed)',
    max_query_time_seconds: 30,
    max_rows_limit: 1000,
  });
});

// --- SSE AGENT LIVE LOG STREAM ---

app.get('/api/agent/stream-logs', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (message: string) => {
    res.write(`data: ${JSON.stringify({ timestamp: Date.now() / 1000, message })}\n\n`);
  };

  sendLog('[INFO] Conexão SSE estabelecida com Protheus Agent Core.');
  sendLog('[INFO] AppServer REST Conector pronto para consultas.');

  const interval = setInterval(() => {
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    sendLog(`[INFO] Agent Healthcheck: Pool ativo, Heap: ${memory}MB, QueryGuard OK.`);
  }, 10000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// --- AGENT COPILOT AI QUERY ENGINE (`/api/agent/ask/v2`) ---

app.post('/api/agent/ask/v2', (req: Request, res: Response) => {
  const { prompt, tenant_id, company, branch, module, company_code, filial } = req.body || {};
  const promptLower = (prompt || '').toLowerCase();
  const startTime = Date.now();

  const selectedTenant = tenant_id || 'TOTVS-ENTERPRISE';
  const selectedCompany = company || company_code || '01';
  const selectedBranch = branch || filial || '01';
  const selectedModule = module || 'FAT';

  let responseData: any = {};

  if (promptLower.includes('fatur') || promptLower.includes('venda') || promptLower.includes('nota') || promptLower.includes('receita')) {
    // Sales & Invoicing Query (SD2/SF2)
    const rows = [
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00102', 'Descrição do Produto': 'Bomba Centrífuga Hidráulica 5CV', 'Qtd': 42, 'Preço Unit (R$)': '2.450,00', 'Valor Total (R$)': '102.900,00', 'Cliente': 'Petrobras S/A', 'Emissão': '28/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00450', 'Descrição do Produto': 'Válvula Esfera Inox 316 2 Pol', 'Qtd': 118, 'Preço Unit (R$)': '580,00', 'Valor Total (R$)': '68.440,00', 'Cliente': 'Braskem Polímeros', 'Emissão': '27/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00789', 'Descrição do Produto': 'Motor Elétrico Trifásico 15CV', 'Qtd': 14, 'Preço Unit (R$)': '4.120,00', 'Valor Total (R$)': '57.680,00', 'Cliente': 'Suzano Papel & Celulose', 'Emissão': '26/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00215', 'Descrição do Produto': 'Painel Automação CLP Protheus', 'Qtd': 6, 'Preço Unit (R$)': '8.900,00', 'Valor Total (R$)': '53.400,00', 'Cliente': 'Klabin Indústria S/A', 'Emissão': '25/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00334', 'Descrição do Produto': 'Sensor Pressão Transmissor 4-20mA', 'Qtd': 85, 'Preço Unit (R$)': '420,00', 'Valor Total (R$)': '35.700,00', 'Cliente': 'Gerdau Aços Especiais', 'Emissão': '24/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00621', 'Descrição do Produto': 'Atuador Pneumático Dupla Ação', 'Qtd': 32, 'Preço Unit (R$)': '950,00', 'Valor Total (R$)': '30.400,00', 'Cliente': 'WEG Equipamentos', 'Emissão': '23/02/2025' },
      { 'Filial': selectedBranch, 'Cód. Produto': 'PROD-00892', 'Descrição do Produto': 'Kit Vedação Alta Temperatura PTFE', 'Qtd': 120, 'Preço Unit (R$)': '185,00', 'Valor Total (R$)': '22.200,00', 'Cliente': 'Vale Mineração', 'Emissão': '22/02/2025' },
    ];

    responseData = {
      title: 'Faturamento Consolidado do Mês (SIGAFAT)',
      subtitle: `Empresa ${selectedCompany} · Filial ${selectedBranch} · Período Atual`,
      summary: `### Resumo Executivo de Faturamento\n\nO faturamento acumulado da **Filial ${selectedBranch}** totaliza **R$ 370.720,00** no mês vigente, distribuído em **7 linhas de produtos industriais de alto valor agregado**.\n\n- **Item Líder de Vendas**: *Bomba Centrífuga Hidráulica 5CV* (R$ 102.900,00 - 27,8% do faturamento total).\n- **Ticket Médio por Pedido**: R$ 52.960,00.\n- **Status Tributário**: Todas as notas emitidas com validação SEFAZ e integração contábil concluída.`,
      kpis: [
        { label: 'Faturamento Total', value: 'R$ 370.720,00', color: 'green' },
        { label: 'Ticket Médio', value: 'R$ 52.960,00', color: 'blue' },
        { label: 'Itens Faturados', value: '417 un', color: 'blue' },
        { label: 'Clientes Atendidos', value: '7 corporativos', color: 'green' },
      ],
      structured: {
        columns: ['Filial', 'Cód. Produto', 'Descrição do Produto', 'Qtd', 'Preço Unit (R$)', 'Valor Total (R$)', 'Cliente', 'Emissão'],
        rows,
        total_records: rows.length,
      },
      insights: `💡 **Insights Comerciais**:\n1. A demanda por *Bombas Centrífugas* e *Válvulas Inox* cresceu 18% em relação ao fechamento do mês anterior.\n2. Recomenda-se verificação preventiva de estoque mínimo no almoxarifado (módulo SIGAEST) para evitar ruptura de vendas no próximo ciclo.`,
      sql: `SELECT \n  SD2.D2_FILIAL AS "Filial",\n  SD2.D2_COD AS "Cód. Produto",\n  SB1.B1_DESC AS "Descrição do Produto",\n  SUM(SD2.D2_QUANT) AS "Qtd",\n  AVG(SD2.D2_PRCVEN) AS "Preço Unit (R$)",\n  SUM(SD2.D2_TOTAL) AS "Valor Total (R$)",\n  SA1.A1_NOME AS "Cliente",\n  MAX(SD2.D2_EMISSAO) AS "Emissão"\nFROM SD2010 SD2\nINNER JOIN SB1010 SB1 ON SB1.B1_COD = SD2.D2_COD AND SB1.D_E_L_E_T_ = ' '\nINNER JOIN SA1010 SA1 ON SA1.A1_COD = SD2.D2_CLIENTE AND SA1.A1_LOJA = SD2.D2_LOJA AND SA1.D_E_L_E_T_ = ' '\nWHERE SD2.D2_FILIAL = '${selectedBranch}'\n  AND SD2.D2_EMISSAO >= '20250201'\n  AND SD2.D_E_L_E_T_ = ' '\nGROUP BY SD2.D2_FILIAL, SD2.D2_COD, SB1.B1_DESC, SA1.A1_NOME\nORDER BY SUM(SD2.D2_TOTAL) DESC;`,
    };
  } else if (promptLower.includes('pagar') || promptLower.includes('título') || promptLower.includes('forneced') || promptLower.includes('vencendo')) {
    // Accounts Payable (SE2)
    const rows = [
      { 'Prefixo': 'DUP', 'Número': '008912', 'Parc': '01', 'Fornecedor': 'Siemens Brasil Ltda', 'CNPJ': '44.123.456/0001-02', 'Vencimento': '03/03/2025', 'Valor (R$)': '48.500,00', 'Saldo (R$)': '48.500,00', 'Status': 'A Vencer' },
      { 'Prefixo': 'DUP', 'Número': '008915', 'Parc': '02', 'Fornecedor': 'Gerdau S/A Aços', 'CNPJ': '33.987.654/0001-88', 'Vencimento': '05/03/2025', 'Valor (R$)': '32.100,00', 'Saldo (R$)': '32.100,00', 'Status': 'A Vencer' },
      { 'Prefixo': 'BOL', 'Número': '009102', 'Parc': '01', 'Fornecedor': 'TOTVS Brasil Software', 'CNPJ': '53.117.014/0001-49', 'Vencimento': '07/03/2025', 'Valor (R$)': '26.800,00', 'Saldo (R$)': '26.800,00', 'Status': 'A Vencer' },
      { 'Prefixo': 'DUP', 'Número': '008840', 'Parc': '03', 'Fornecedor': 'Schneider Electric', 'CNPJ': '10.555.333/0001-12', 'Vencimento': '08/03/2025', 'Valor (R$)': '19.450,00', 'Saldo (R$)': '19.450,00', 'Status': 'A Vencer' },
      { 'Prefixo': 'CON', 'Número': '001205', 'Parc': '01', 'Fornecedor': 'Enel Distribuição Energia', 'CNPJ': '07.234.876/0001-55', 'Vencimento': '10/03/2025', 'Valor (R$)': '14.220,00', 'Saldo (R$)': '14.220,00', 'Status': 'A Vencer' },
      { 'Prefixo': 'IMP', 'Número': '000412', 'Parc': '01', 'Fornecedor': 'Receita Federal - DARF IRPJ', 'CNPJ': '00.394.460/0058-87', 'Vencimento': '10/03/2025', 'Valor (R$)': '11.890,00', 'Saldo (R$)': '11.890,00', 'Status': 'A Vencer' },
    ];

    responseData = {
      title: 'Títulos a Pagar Vencendo nos Próximos 7 Dias (SIGAFIN)',
      subtitle: `Tabela SE2010 · Filial ${selectedBranch} · Projeção de Fluxo de Caixa`,
      summary: `### Contas a Pagar (Próximos 7 Dias)\n\nForam localizados **6 títulos a pagar** com vencimento previsto entre **03/03 e 10/03/2025**, totalizando um compromisso financeiro de **R$ 152.960,00**.\n\n- **Maior Compromisso**: *Siemens Brasil Ltda* (R$ 48.500,00 - Materiais elétricos).\n- **Impacto em Caixa**: Necessidade de liquidez confirmada junto às contas bancárias correntes (Banco do Brasil e Itaú).`,
      kpis: [
        { label: 'Total a Pagar', value: 'R$ 152.960,00', color: 'yellow' },
        { label: 'Títulos no Período', value: '6 títulos', color: 'blue' },
        { label: 'Média por Título', value: 'R$ 25.493,00', color: 'blue' },
        { label: 'Títulos Vencidos', value: '0 (Em dia)', color: 'green' },
      ],
      structured: {
        columns: ['Prefixo', 'Número', 'Parc', 'Fornecedor', 'CNPJ', 'Vencimento', 'Valor (R$)', 'Saldo (R$)', 'Status'],
        rows,
        total_records: rows.length,
      },
      insights: `💼 **Recomendação Financeira**:\nNenhum título encontra-se em atraso ou incidindo juros/multa. As aprovações de pagamento já foram sincronizadas via alçada no módulo SIGAFIN.`,
      sql: `SELECT \n  SE2.E2_PREFIXO AS "Prefixo",\n  SE2.E2_NUM AS "Número",\n  SE2.E2_PARCELA AS "Parc",\n  SE2.E2_NOMFOR AS "Fornecedor",\n  SE2.E2_CGC AS "CNPJ",\n  SE2.E2_VENCTO AS "Vencimento",\n  SE2.E2_VALOR AS "Valor (R$)",\n  SE2.E2_SALDO AS "Saldo (R$)",\n  CASE WHEN SE2.E2_VENCTO < CURRENT_DATE THEN 'Vencido' ELSE 'A Vencer' END AS "Status"\nFROM SE2010 SE2\nWHERE SE2.E2_FILIAL = '${selectedBranch}'\n  AND SE2.E2_SALDO > 0\n  AND SE2.E2_VENCTO BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)\n  AND SE2.D_E_L_E_T_ = ' '\nORDER BY SE2.E2_VENCTO ASC;`,
    };
  } else if (promptLower.includes('produto') || promptLower.includes('estoque') || promptLower.includes('saldo') || promptLower.includes('almox')) {
    // Inventory & Stock Balances (SB1/SB2)
    const rows = [
      { 'Cód. Produto': 'PROD-00102', 'Descrição': 'Bomba Centrífuga Hidráulica 5CV', 'Unidade': 'UN', 'Local': '01', 'Saldo Físico': 34, 'Reservado': 8, 'Disponível': 26, 'Custo Médio (R$)': '1.820,00', 'Valor Total (R$)': '61.880,00' },
      { 'Cód. Produto': 'PROD-00450', 'Descrição': 'Válvula Esfera Inox 316 2 Pol', 'Unidade': 'PC', 'Local': '01', 'Saldo Físico': 142, 'Reservado': 20, 'Disponível': 122, 'Custo Médio (R$)': '390,00', 'Valor Total (R$)': '55.380,00' },
      { 'Cód. Produto': 'PROD-00789', 'Descrição': 'Motor Elétrico Trifásico 15CV', 'Unidade': 'UN', 'Local': '01', 'Saldo Físico': 18, 'Reservado': 4, 'Disponível': 14, 'Custo Médio (R$)': '2.950,00', 'Valor Total (R$)': '53.100,00' },
      { 'Cód. Produto': 'PROD-00215', 'Descrição': 'Painel Automação CLP Protheus', 'Unidade': 'CJ', 'Local': '02', 'Saldo Físico': 9, 'Reservado': 2, 'Disponível': 7, 'Custo Médio (R$)': '5.800,00', 'Valor Total (R$)': '52.200,00' },
      { 'Cód. Produto': 'PROD-00334', 'Descrição': 'Sensor Pressão Transmissor 4-20mA', 'Unidade': 'UN', 'Local': '01', 'Saldo Físico': 95, 'Reservado': 15, 'Disponível': 80, 'Custo Médio (R$)': '280,00', 'Valor Total (R$)': '26.600,00' },
    ];

    responseData = {
      title: 'Top 5 Produtos em Valor de Estoque (SIGAEST)',
      subtitle: `Tabelas SB1010 / SB2010 · Almoxarifado Filial ${selectedBranch}`,
      summary: `### Posição Física e Financeira de Estoque\n\nOs 5 principais itens no almoxarifado somam **R$ 249.160,00** em custo contábil médio, com taxa de disponibilidade imediata de **84,5%** sobre o saldo físico.\n\n- **Item com Maior Valor Total**: *Bomba Centrífuga Hidráulica 5CV* (R$ 61.880,00).\n- **Estoque de Segurança**: Todos os 5 itens estão acima do ponto de pedido configurado no campo B1_EMIN.`,
      kpis: [
        { label: 'Valor em Estoque', value: 'R$ 249.160,00', color: 'blue' },
        { label: 'Qtd Total em Saldo', value: '298 itens', color: 'green' },
        { label: 'Qtd Reservada em Pedidos', value: '49 itens', color: 'yellow' },
        { label: 'Disponibilidade Efetiva', value: '84.5%', color: 'green' },
      ],
      structured: {
        columns: ['Cód. Produto', 'Descrição', 'Unidade', 'Local', 'Saldo Físico', 'Reservado', 'Disponível', 'Custo Médio (R$)', 'Valor Total (R$)'],
        rows,
        total_records: rows.length,
      },
      insights: `📦 **Gestão de Suprimentos**:\nO giro médio dos itens nos últimos 90 dias é de 32 dias. O giro do produto *PROD-00450 (Válvula Inox)* é o mais dinâmico da categoria.`,
      sql: `SELECT \n  SB2.B2_COD AS "Cód. Produto",\n  SB1.B1_DESC AS "Descrição",\n  SB1.B1_UM AS "Unidade",\n  SB2.B2_LOCAL AS "Local",\n  SB2.B2_QATU AS "Saldo Físico",\n  SB2.B2_RESERVA AS "Reservado",\n  (SB2.B2_QATU - SB2.B2_RESERVA) AS "Disponível",\n  SB2.B2_CM1 AS "Custo Médio (R$)",\n  SB2.B2_VATU1 AS "Valor Total (R$)"\nFROM SB2010 SB2\nINNER JOIN SB1010 SB1 ON SB1.B1_COD = SB2.B2_COD AND SB1.D_E_L_E_T_ = ' '\nWHERE SB2.B2_FILIAL = '${selectedBranch}'\n  AND SB2.B2_QATU > 0\n  AND SB2.D_E_L_E_T_ = ' '\nORDER BY SB2.B2_VATU1 DESC\nLIMIT 5;`,
    };
  } else if (promptLower.includes('cliente') || promptLower.includes('risco') || promptLower.includes('inadimpl') || promptLower.includes('receber')) {
    // Receivables & Customer Risk (SE1 / SA1)
    const rows = [
      { 'Cód. Cliente': 'CLI-0041', 'Razão Social': 'Metalúrgica Paulista Ltda', 'Classif. Risco': 'Risco C (Alerta)', 'Limite Crédito (R$)': '100.000,00', 'Títulos em Aberto (R$)': '82.400,00', 'Vencidos > 30d (R$)': '24.100,00', 'Atraso Médio': '38 dias' },
      { 'Cód. Cliente': 'CLI-0078', 'Razão Social': 'Construtora Vale do Sol S/A', 'Classif. Risco': 'Risco B (Monitorado)', 'Limite Crédito (R$)': '150.000,00', 'Títulos em Aberto (R$)': '64.900,00', 'Vencidos > 30d (R$)': '12.800,00', 'Atraso Médio': '19 dias' },
      { 'Cód. Cliente': 'CLI-0112', 'Razão Social': 'Distribuidora Central de Peças', 'Classif. Risco': 'Risco B (Monitorado)', 'Limite Crédito (R$)': '80.000,00', 'Títulos em Aberto (R$)': '51.300,00', 'Vencidos > 30d (R$)': '8.200,00', 'Atraso Médio': '14 dias' },
      { 'Cód. Cliente': 'CLI-0205', 'Razão Social': 'Indústria Química Nordeste', 'Classif. Risco': 'Risco A (Baixo)', 'Limite Crédito (R$)': '300.000,00', 'Títulos em Aberto (R$)': '110.000,00', 'Vencidos > 30d (R$)': '0,00', 'Atraso Médio': '0 dias' },
    ];

    responseData = {
      title: 'Análise de Risco de Crédito e Inadimplência (SIGAFIN)',
      subtitle: `Tabelas SA1010 / SE1010 · Filial ${selectedBranch} · Carteira de Recebíveis`,
      summary: `### Carteira de Clientes e Risco de Inadimplência\n\nA carteira monitorada totaliza **R$ 308.600,00** em títulos a receber, dos quais **R$ 45.100,00** (14,6%) apresentam vencimento superior a 30 dias.\n\n- **Principal Ponto de Atenção**: *Metalúrgica Paulista Ltda* possui R$ 24.100,00 vencidos há 38 dias, com comprometimento de 82,4% do limite de crédito.\n- **Bloqueio Preventivo**: Regra de bloqueio de pedidos no SIGAFAT ativada para clientes com atraso superior a 30 dias.`,
      kpis: [
        { label: 'Carteira a Receber', value: 'R$ 308.600,00', color: 'blue' },
        { label: 'Inadimplência > 30d', value: 'R$ 45.100,00', color: 'red' },
        { label: 'Índice de Atraso', value: '14.6%', color: 'yellow' },
        { label: 'Limite Total Liberado', value: 'R$ 630.000,00', color: 'green' },
      ],
      structured: {
        columns: ['Cód. Cliente', 'Razão Social', 'Classif. Risco', 'Limite Crédito (R$)', 'Títulos em Aberto (R$)', 'Vencidos > 30d (R$)', 'Atraso Médio'],
        rows,
        total_records: rows.length,
      },
      insights: `⚠️ **Ação Recomendada pelo Agente**:\n1. Notificar a equipe de cobrança para renegociação com *Metalúrgica Paulista*.\n2. Manter suspensa a emissão de novos pedidos para clientes com Risco C até a baixa dos títulos vencidos.`,
      sql: `SELECT \n  SA1.A1_COD AS "Cód. Cliente",\n  SA1.A1_NOME AS "Razão Social",\n  SA1.A1_RISCO AS "Classif. Risco",\n  SA1.A1_LC AS "Limite Crédito (R$)",\n  SUM(SE1.E1_SALDO) AS "Títulos em Aberto (R$)",\n  SUM(CASE WHEN SE1.E1_VENCTO < (CURRENT_DATE - 30) THEN SE1.E1_SALDO ELSE 0 END) AS "Vencidos > 30d (R$)",\n  AVG(GREATEST(0, CURRENT_DATE - SE1.E1_VENCTO)) AS "Atraso Médio"\nFROM SA1010 SA1\nINNER JOIN SE1010 SE1 ON SE1.E1_CLIENTE = SA1.A1_COD AND SE1.E1_LOJA = SA1.A1_LOJA AND SE1.D_E_L_E_T_ = ' '\nWHERE SE1.E1_FILIAL = '${selectedBranch}'\n  AND SE1.E1_SALDO > 0\n  AND SA1.D_E_L_E_T_ = ' '\nGROUP BY SA1.A1_COD, SA1.A1_NOME, SA1.A1_RISCO, SA1.A1_LC\nORDER BY "Vencidos > 30d (R$)" DESC;`,
    };
  } else {
    // Dynamic Protheus General Query Response
    const rows = [
      { 'Módulo': selectedModule, 'Código': 'CAD-001', 'Descrição': `Registro Operacional ${selectedModule}`, 'Status': 'Ativo', 'Valor Ref (R$)': '14.500,00', 'Última Atualização': new Date().toLocaleDateString('pt-BR') },
      { 'Módulo': selectedModule, 'Código': 'CAD-002', 'Descrição': `Processamento Contábil Filial ${selectedBranch}`, 'Status': 'Consolidado', 'Valor Ref (R$)': '32.800,00', 'Última Atualização': new Date().toLocaleDateString('pt-BR') },
      { 'Módulo': selectedModule, 'Código': 'CAD-003', 'Descrição': `Parâmetro de Sistema SX6`, 'Status': 'Em Vigor', 'Valor Ref (R$)': '8.200,00', 'Última Atualização': new Date().toLocaleDateString('pt-BR') },
    ];

    responseData = {
      title: `Consulta Protheus (${selectedModule} - Filial ${selectedBranch})`,
      subtitle: `Tenant: ${selectedTenant} · Empresa: ${selectedCompany} · Filial: ${selectedBranch}`,
      summary: `### Resumo da Consulta no Protheus\n\nFoi realizada a busca autorizada para a solicitação: *"${prompt}"* no módulo **${selectedModule}** do Protheus ERP.\n\nOs registros foram extraídos e validados através do conector seguro QueryRest em conformidade com as regras de governança e segurança de dados da empresa.`,
      kpis: [
        { label: 'Status da Consulta', value: 'Concluída 100%', color: 'green' },
        { label: 'Módulo Alvo', value: selectedModule, color: 'blue' },
        { label: 'Filial Consultada', value: selectedBranch, color: 'blue' },
        { label: 'Registros', value: `${rows.length} linhas`, color: 'green' },
      ],
      structured: {
        columns: ['Módulo', 'Código', 'Descrição', 'Status', 'Valor Ref (R$)', 'Última Atualização'],
        rows,
        total_records: rows.length,
      },
      insights: `✅ **Diagnóstico Protheus**: Todos os parâmetros e permissões foram validados pelo Query Guard. Nenhum bloqueio de alçada encontrado.`,
      sql: `SELECT \n  '${selectedModule}' AS "Módulo",\n  'CAD-001' AS "Código",\n  'Registro Protheus' AS "Descrição",\n  'Ativo' AS "Status"\nFROM SX2010 SX2\nWHERE SX2.X2_CHAVE LIKE '${selectedModule}%'\n  AND SX2.D_E_L_E_T_ = ' ';`,
    };
  }

  const duration = Date.now() - startTime;

  res.json({
    status: 'success',
    tenant_code: selectedTenant,
    tenant_id: selectedTenant,
    company_id: selectedCompany,
    environment_code: 'PROD',
    response_time_ms: duration,
    records: responseData.structured?.rows?.length || 0,
    entitlement: {
      plan_code: 'Enterprise Unlimited',
      query_limit: 150000,
      queries_used: 18421,
      remaining_queries: 131579,
      active_sessions: 4,
      concurrent_sessions_limit: 25,
    },
    ...responseData,
  });
});

app.get('/api/agent/ask/v2/status/:taskId', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    task_id: req.params.taskId,
    progress: 100,
  });
});

// --- EXPORT STRUCTURED REPORT ROUTE ---

app.post('/api/report/export-structured', (req: Request, res: Response) => {
  const { title, format } = req.body || {};
  res.json({
    status: 'ready',
    title: title || 'Relatorio_Copilot_Protheus',
    format: format || 'xlsx',
    download_url: `data:application/octet-stream;charset=utf-8,Mock_Export_${Date.now()}`,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
});

// --- Vite Middleware in Development / Static Serving in Production ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Copilot Protheus] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

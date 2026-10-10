import { 
  ConversationItem, 
  CopilotMessage, 
  CopilotSessionContext 
} from '../types/chat.types';
import { 
  askAgent, 
  waitForAgentTask, 
  getConversations, 
  createConversation, 
  getConversation,
  addConversationMessage,
  addConversationDashboard
} from '../../../services/api';
import { normalizeAgentResult } from '../../../utils/normalizeAgentResult';
import { buildAdaptiveDashboard } from '../../../services/adaptiveDashboardEngine';

const USE_MOCK = import.meta.env.VITE_COPILOT_USE_MOCK === 'true';

// Mock generator for offline / test demonstration
function createMockResponse(prompt: string): { content: string; suggestions: string[]; dashboard: any } {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('fluxo') || lower.includes('caixa')) {
    return {
      content: `Análise concluída.\n\nA projeção de caixa para os próximos 30 dias indica saldo positivo consolidado de R$ 840 mil.\nOs recebimentos programados somam R$ 1,42 milhão contra pagamentos previstos de R$ 580 mil.\nO índice de cobertura operacional atual é de 2,45x.`,
      suggestions: [
        'Ver maiores desembolsos da semana',
        'Simular inadimplência de 10%',
        'Abrir conciliação bancária'
      ],
      dashboard: {
        id: 'dash-mock-caixa',
        title: 'Fluxo de Caixa 30 Dias',
        originPrompt: prompt,
        screenType: 'finance',
        updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { label: 'Saldo Projetado', value: 'R$ 840.000', change: '+12%', tone: 'positive' },
          { label: 'A Receber', value: 'R$ 1.420.000', change: '+5%', tone: 'neutral' },
          { label: 'A Pagar', value: 'R$ 580.000', change: '-3%', tone: 'positive' },
        ],
        columns: ['TIPO_MOVIMENTO', 'NUM_TITULO', 'CLIENTE', 'DATA_VENCTO', 'VALOR'],
        rows: [
          { TIPO_MOVIMENTO: 'RECEBIMENTO', NUM_TITULO: '000142', CLIENTE: 'ATACADO DISTRIBUIDOR LTDA', DATA_VENCTO: '22/09/2026', VALOR: 38450.00 },
          { TIPO_MOVIMENTO: 'PAGAMENTO', NUM_TITULO: '084920', CLIENTE: 'FORNECEDOR MATERIAIS S.A.', DATA_VENCTO: '24/09/2026', VALOR: 18200.00 },
          { TIPO_MOVIMENTO: 'RECEBIMENTO', NUM_TITULO: '000143', CLIENTE: 'SUPERMERCADOS UNIAO EIRELI', DATA_VENCTO: '25/09/2026', VALOR: 54100.00 },
          { TIPO_MOVIMENTO: 'PAGAMENTO', NUM_TITULO: '084925', CLIENTE: 'ENERGIA E TELECOMUNICACOES', DATA_VENCTO: '28/09/2026', VALOR: 9800.00 },
          { TIPO_MOVIMENTO: 'RECEBIMENTO', NUM_TITULO: '000145', CLIENTE: 'COMERCIAL SANTOS & CIA', DATA_VENCTO: '30/09/2026', VALOR: 42300.00 }
        ]
      }
    };
  }

  if (lower.includes('inadimpl') || lower.includes('cliente')) {
    return {
      content: `Análise concluída.\n\nIdentificamos 14 clientes com títulos vencidos acima de 60 dias, totalizando R$ 318 mil em risco.\nO maior devedor concentra 41,2% deste montante em duas duplicatas em aberto.\nRecomenda-se bloqueio automático de pedidos para títulos em atraso.`,
      suggestions: [
        'Extrato analítico do maior devedor',
        'Contatar equipe de cobrança',
        'Ver histórico de renegociação'
      ],
      dashboard: {
        id: 'dash-mock-inadimpl',
        title: 'Inadimplência Carteira',
        originPrompt: prompt,
        screenType: 'credit_risk',
        updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        kpis: [
          { label: 'Total Vencido >60d', value: 'R$ 318.450', change: '+8%', tone: 'negative' },
          { label: 'Clientes em Atraso', value: '14', change: '-2', tone: 'neutral' },
          { label: 'Concentração Top 1', value: '41,2%', change: 'Alto Risco', tone: 'negative' }
        ],
        columns: ['NUM_TITULO', 'CLIENTE', 'DATA_VENCTO', 'VALOR'],
        rows: [
          { NUM_TITULO: '000112', CLIENTE: 'COMERCIO VAREJISTA CENTRAL', DATA_VENCTO: '15/07/2026', VALOR: 131200.00 },
          { NUM_TITULO: '000115', CLIENTE: 'DELTA LOGISTICA E TRANSPORTES', DATA_VENCTO: '20/07/2026', VALOR: 84300.00 },
          { NUM_TITULO: '000119', CLIENTE: 'REDE SUL DE ALIMENTOS', DATA_VENCTO: '02/08/2026', VALOR: 48500.00 },
          { NUM_TITULO: '000122', CLIENTE: 'MERCADO BOM PRECO', DATA_VENCTO: '10/08/2026', VALOR: 32450.00 },
          { NUM_TITULO: '000128', CLIENTE: 'DISTRIBUIDORA NORTE', DATA_VENCTO: '18/08/2026', VALOR: 22000.00 }
        ]
      }
    };
  }

  return {
    content: `Análise concluída.\n\nAs vendas do período totalizaram R$ 1,12 milhão.\nO principal vendedor respondeu por 27,3% do faturamento.\nOs três primeiros concentraram 45,2% do volume total.`,
    suggestions: [
      'Comparar com mês anterior',
      'Mostrar Top 20 vendedores',
      'Analisar margem por linha'
    ],
    dashboard: {
      id: 'dash-mock-vendas',
      title: 'Faturamento do Mês',
      originPrompt: prompt,
      screenType: 'sales',
      updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      kpis: [
        { label: 'Faturamento Total', value: 'R$ 1.120.000', change: '+14,2%', tone: 'positive' },
        { label: 'Ticket Médio', value: 'R$ 18.400', change: '+4,1%', tone: 'positive' },
        { label: 'Participação Top 1', value: '27,3%', change: 'Equilibrado', tone: 'neutral' }
      ],
      columns: ['VENDEDOR', 'QTD_PEDIDOS', 'FATURAMENTO'],
      rows: [
        { VENDEDOR: 'CARLOS SILVA', QTD_PEDIDOS: 436, FATURAMENTO: 1220448.54 },
        { VENDEDOR: 'MARCOS OLIVEIRA', QTD_PEDIDOS: 37, FATURAMENTO: 699299.42 },
        { VENDEDOR: 'ANA BEATRIZ SANTOS', QTD_PEDIDOS: 125, FATURAMENTO: 335211.76 },
        { VENDEDOR: 'ROBERTO ALMEIDA', QTD_PEDIDOS: 43, FATURAMENTO: 224153.82 },
        { VENDEDOR: 'JULIANA LIMA', QTD_PEDIDOS: 185, FATURAMENTO: 213486.29 },
        { VENDEDOR: 'FERNANDO COSTA', QTD_PEDIDOS: 131, FATURAMENTO: 210602.76 }
      ]
    }
  };
}

export async function fetchConversationList(context?: CopilotSessionContext): Promise<ConversationItem[]> {
  if (USE_MOCK) {
    const saved = localStorage.getItem('cprot_mock_conversations');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: 'conv-1', title: 'Faturamento acumulado por vendedor', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isFavorite: true },
      { id: 'conv-2', title: 'Projeção de fluxo de caixa 30d', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  try {
    const res = await getConversations({
      tenant_id: context?.tenantId,
      user_id: context?.userId,
      limit: 30
    });
    const items = res?.conversations || [];
    return items.map((c: any) => ({
      id: c.id,
      title: c.title || 'Consulta sem título',
      createdAt: c.created_at || new Date().toISOString(),
      updatedAt: c.updated_at || new Date().toISOString(),
      isFavorite: Boolean(c.is_favorite),
      lastMessage: c.last_message || ''
    }));
  } catch (err) {
    console.warn('[CopilotChatApi] Falha ao listar conversas do backend:', err);
    return [];
  }
}

export async function createNewConversationRemote(title: string, context?: CopilotSessionContext): Promise<string> {
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();

  if (USE_MOCK) {
    return newId;
  }

  try {
    const res = await createConversation({
      id: newId,
      title,
      tenant_id: context?.tenantId || '',
      user_id: context?.userId || '',
      company: context?.company || '',
      branch: context?.branch || '',
      environment: context?.environment || '',
      module: context?.module || 'SIGAFAT'
    });
    // O backend retorna o identificador persistido dentro de `conversation.id`.
    // Usar apenas o UUID local causava GET 404, pois ele não era o registro inserido.
    return res?.conversation?.id || res?.id || newId;
  } catch (err) {
    console.warn('[CopilotChatApi] createConversation fallback para local ID:', err);
    return newId;
  }
}

export async function fetchConversationMessagesRemote(conversationId: string): Promise<CopilotMessage[]> {
  if (USE_MOCK) return [];

  try {
    const res = await getConversation(conversationId);
    const conversation = res?.conversation || res;
    const messages = conversation?.messages || [];
    return messages.map((m: any) => ({
      id: m.id || String(m.timestamp),
      role: m.role || 'assistant',
      content: m.message || m.content || '',
      status: 'done',
      timestamp: m.created_at || m.timestamp || new Date().toISOString(),
      dashboard: m.metadata?.dashboard || null,
      suggestions: m.metadata?.suggestions || []
    }));
  } catch (err) {
    console.warn('[CopilotChatApi] getConversation error:', err);
    return [];
  }
}

export async function askCopilotQuery(
  conversationId: string,
  prompt: string,
  context?: CopilotSessionContext,
  signal?: AbortSignal
): Promise<{ content: string; suggestions: string[]; dashboard: any, analysisId?: string, dashboardId?: string }> {
  if (USE_MOCK) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1400);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    return createMockResponse(prompt);
  }

  const { sendConversationTurn } = await import('../../../services/api');

  const payload = {
    company: context?.company || '',
    branch: context?.branch || '',
    environment: context?.environment || '',
    environment_code: context?.environment || '',
    module: context?.module || context?.currentModule || 'SIGAFAT',
    module_sigla: context?.module || context?.currentModule || 'SIGAFAT',
    prompt: prompt,
    execute: true,
  };

  const response = await sendConversationTurn(conversationId, payload);

  const finalContent = response.content || response.message || 'Análise concluída com sucesso.';
  const suggestions = response.suggestions || [
    'Comparar com período anterior',
    'Exibir detalhamento dos itens',
    'Analisar concentração de volume'
  ];

  const dashboardPayload = response.presentation 
    || response.dashboard 
    || (Array.isArray(response.data) && response.data.length > 0 ? {
        title: prompt,
        originPrompt: prompt,
        rows: response.data,
        columns: response.result?.columns || Object.keys(response.data[0] || {}),
        backend_kpis: response.result?.backend_kpis,
        backend_insights: response.result?.backend_insights,
      } : (Array.isArray(response.result?.rows) && response.result.rows.length > 0 ? {
        title: prompt,
        originPrompt: prompt,
        rows: response.result.rows,
        columns: response.result.columns || Object.keys(response.result.rows[0] || {}),
        backend_kpis: response.result?.backend_kpis,
        backend_insights: response.result?.backend_insights,
      } : null));

  return {
    content: finalContent,
    suggestions: suggestions.slice(0, 3),
    dashboard: dashboardPayload,
    analysisId: response.analysisId || response.analysis_id || null,
    dashboardId: response.dashboardId || response.dashboard_id || null
  };
}

export async function syncRemoteMessage(
  conversationId: string, 
  role: string, 
  content: string, 
  metadata: any = {}
): Promise<void> {
  if (USE_MOCK || !conversationId) return;
  try {
    await addConversationMessage(conversationId, {
      role,
      message: content,
      metadata
    });
    if (metadata?.dashboard) {
      await addConversationDashboard(conversationId, {
        title: metadata.originPrompt || 'Dashboard',
        dashboard_type: metadata.dashboard.screenType || 'ranking',
        query: metadata.dashboard.sql_query || null,
        dashboard_json: metadata.dashboard,
        insight_json: metadata.dashboard.insights || []
      });
    }
  } catch (e) {
    console.warn('[CopilotChatApi] syncRemoteMessage error:', e);
  }
}

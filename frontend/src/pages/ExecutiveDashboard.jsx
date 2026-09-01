import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { askAgent, getAgentTaskStatus } from '../services/api';

export default function ExecutiveDashboard({ onNavigateToWorkspace }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [period, setPeriod] = useState('Mês Atual');
  const [chartView, setChartView] = useState('semanal');
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! Notei uma variação de 12% no DDA para o próximo vencimento no Protheus. Deseja que eu analise o detalhamento das duplicatas a pagar?',
      suggestions: ['Sim, analisar DDA', 'Ver pedidos de hoje', 'Top 5 clientes do mês']
    }
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  const handleSendCopilot = async (customPrompt) => {
    const question = customPrompt || copilotQuestion;
    if (!question.trim() || isCopilotLoading) return;

    const userTurn = { role: 'user', text: question };
    setCopilotMessages(prev => [...prev, userTurn]);
    setCopilotQuestion('');
    setIsCopilotLoading(true);

    try {
      const response = await askAgent({
        prompt: question,
        tenant_id: 'rodol_prod',
        environment_code: 'c8te0u_prod',
        empresa: '01',
        filial: '0101',
        module: 'SIGAFAT',
        conversation_id: 'dash-' + Date.now()
      });

      let replyText = 'Consulta processada com sucesso no Protheus.';
      if (response?.task_id) {
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 1500));
          const status = await getAgentTaskStatus(response.task_id);
          if (status.status === 'completed') {
            replyText = status.response_text || 'Aqui está o resultado da sua consulta no Protheus.';
            break;
          }
          if (status.status === 'failed') {
            replyText = `Falha na consulta: ${status.error || 'Erro na execução SQL'}`;
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
      {/* 1. Sidebar de Navegação Executiva */}
      <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0 z-20">
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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#0f66ff] text-white shadow-sm'
                : 'text-[#475569] hover:bg-[#eff4f9] hover:text-[#0f172a]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('fluxo')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              activeTab === 'fluxo'
                ? 'bg-[#0f66ff] text-white shadow-sm'
                : 'text-[#475569] hover:bg-[#eff4f9] hover:text-[#0f172a]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Fluxo de Caixa</span>
          </button>

          <button
            onClick={() => setActiveTab('vendas')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              activeTab === 'vendas'
                ? 'bg-[#0f66ff] text-white shadow-sm'
                : 'text-[#475569] hover:bg-[#eff4f9] hover:text-[#0f172a]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Análise de Vendas</span>
          </button>

          <div className="pt-4 pb-1 px-3">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Espaço de Trabalho</span>
          </div>

          <button
            onClick={onNavigateToWorkspace}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-[#004fce] bg-[#e0ecff] hover:bg-[#d0e2ff] transition-all border border-[#bfd5fe]"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#004fce]" />
              <span>Workspace Copilot</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </nav>

        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center gap-2 text-[12px] text-[#475569]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
            <span className="font-medium">Oracle TOTVS Cloud</span>
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-0.5 font-mono">c8te0u_prod (Emp. 01 / 0101)</div>
        </div>
      </aside>

      {/* 2. Área Central do Dashboard (70%) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="bg-[#eff4f9] px-3 py-1.5 rounded-lg flex items-center gap-2 text-[#475569] text-[13px] font-medium border border-[#e2e8f0]">
              <Building2 className="w-4 h-4 text-[#004fce]" />
              <span>EliteCorp / Matriz</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8]" />
            </div>

            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Pesquisar no Protheus..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-[13px] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#004fce]/20 focus:border-[#004fce] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToWorkspace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4f9] hover:bg-[#e2e8f0] text-[#004fce] text-xs font-semibold border border-[#e2e8f0] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir Copilot Chat</span>
            </button>

            <div className="text-right hidden sm:block">
              <div className="text-[13px] font-bold text-[#0f172a]">Diretoria Executiva</div>
              <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">C-Level / Finanças</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#004fce] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">Visão Geral Executiva</h1>
              <p className="text-sm text-[#64748b]">Painel consolidado de inteligência financeira e operacional</p>
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

          {/* Banner Executivo Decorativo */}
          <div className="relative w-full h-28 rounded-2xl overflow-hidden bg-gradient-to-r from-[#004fce] via-[#0f66ff] to-[#495f82] p-6 text-white flex items-center justify-between shadow-sm">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold mb-1 backdrop-blur-sm">
                <Sparkles className="w-3 h-3" />
                <span>Inteligência Cognitiva Ativa</span>
              </div>
              <h2 className="text-xl font-bold">Gestão Estratégica Protheus em Tempo Real</h2>
              <p className="text-xs text-white/80">Dados atualizados e sincronizados via Oracle REST QueryRest</p>
            </div>
            <div className="hidden md:flex items-center gap-4 relative z-10">
              <div className="text-right">
                <div className="text-xs text-white/75">Previsão de Receita</div>
                <div className="text-xl font-bold">R$ 1.840.000</div>
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/10 blur-3xl rounded-full transform translate-x-12"></div>
          </div>

          {/* 4 Cards Bento de KPIs Executivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden group hover:border-[#004fce]/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Saldo Disponível</span>
                <div className="w-8 h-8 rounded-lg bg-[#eff4f9] flex items-center justify-center text-[#004fce]">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#0f172a] mb-2">R$ 1.240.500</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] font-semibold">
                  <ArrowUpRight className="w-3 h-3" /> 4.2%
                </span>
                <span className="text-[#94a3b8]">vs mês anterior</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden group hover:border-[#ef4444]/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Contas a Pagar</span>
                <div className="w-8 h-8 rounded-lg bg-[#fef2f2] flex items-center justify-center text-[#ef4444]">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#0f172a] mb-2">R$ 480.230</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ef4444]/10 text-[#ef4444] font-semibold">
                  <ArrowUpRight className="w-3 h-3" /> 1.5%
                </span>
                <span className="text-[#94a3b8]">vs mês anterior</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm relative overflow-hidden group hover:border-[#22c55e]/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Contas a Receber</span>
                <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] flex items-center justify-center text-[#22c55e]">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#0f172a] mb-2">R$ 890.750</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] font-semibold">
                  <ArrowUpRight className="w-3 h-3" /> 8.7%
                </span>
                <span className="text-[#94a3b8]">vs mês anterior</span>
              </div>
            </div>

            <div className="bg-[#004fce] rounded-xl p-5 text-white shadow-md shadow-[#004fce]/20 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Lucro Líquido</span>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white mb-2 relative z-10">R$ 310.420</div>
              <div className="flex items-center gap-1.5 text-xs relative z-10">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                  <ArrowUpRight className="w-3 h-3" /> 12.4%
                </span>
                <span className="text-white/70">vs mês anterior</span>
              </div>
            </div>
          </div>

          {/* Gráficos e Transações */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-[16px]">Fluxo de Caixa Projetado</h3>
                  <p className="text-xs text-[#64748b]">Projeção de liquidez para as próximas semanas</p>
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
                    <span>R$ 1.5M</span>
                  </div>
                  <div className="border-b border-[#f1f5f9] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>R$ 1.0M</span>
                  </div>
                  <div className="border-b border-[#f1f5f9] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>R$ 500k</span>
                  </div>
                  <div className="border-b border-[#e2e8f0] w-full flex justify-between text-[10px] text-[#94a3b8]">
                    <span>R$ 0</span>
                  </div>
                </div>

                <svg className="w-full h-full absolute inset-0 pb-6 overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
                  <defs>
                    <linearGradient id="stitchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#004fce" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#004fce" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0,180 Q 150,210 300,140 T 550,90 T 800,40 L 800,240 L 0,240 Z"
                    fill="url(#stitchGrad)"
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
                  <span>01 Nov</span>
                  <span>08 Nov</span>
                  <span>15 Nov</span>
                  <span>22 Nov</span>
                  <span>29 Nov</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-[#0f172a] text-[16px] mb-1">Composição de Despesas</h3>
                <p className="text-xs text-[#64748b] mb-4">Maiores centros de custos no período</p>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[#475569]">Folha de Pagamento</span>
                      <span className="text-[#0f172a]">45% (R$ 216k)</span>
                    </div>
                    <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#004fce] rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[#475569]">Fornecedores / Insumos</span>
                      <span className="text-[#0f172a]">32% (R$ 153k)</span>
                    </div>
                    <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0f66ff] rounded-full" style={{ width: '32%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[#475569]">Tributário e Impostos</span>
                      <span className="text-[#0f172a]">15% (R$ 72k)</span>
                    </div>
                    <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: '15%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[#475569]">Infraestrutura / TI</span>
                      <span className="text-[#0f172a]">8% (R$ 38k)</span>
                    </div>
                    <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#64748b] rounded-full" style={{ width: '8%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                <button
                  onClick={() => handleSendCopilot('Quais são as 5 maiores notas fiscais de entrada deste mês?')}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#eff4f9] hover:bg-[#e2e8f0] text-[#004fce] text-xs font-bold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analisar Despesas com IA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Transações Recentes */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div>
                <h3 className="font-bold text-[#0f172a] text-[15px]">Últimas Movimentações Financeiras</h3>
                <p className="text-xs text-[#64748b]">Títulos e duplicatas integradas via SE1 / SE2</p>
              </div>
              <button
                onClick={() => handleSendCopilot('Listar todos os títulos a pagar vencendo esta semana')}
                className="text-xs font-semibold text-[#004fce] hover:underline flex items-center gap-1"
              >
                <span>Ver todos no Copilot</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#64748b] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="px-6 py-3">Data / Vencimento</th>
                    <th className="px-6 py-3">Descrição / Fornecedor / Cliente</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  <tr className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[#64748b]">Hoje, 09:41</td>
                    <td className="px-6 py-3.5 font-semibold text-[#0f172a]">Pagamento Fornecedor ABC Logística</td>
                    <td className="px-6 py-3.5 text-[#64748b]">Contas a Pagar</td>
                    <td className="px-6 py-3.5 text-right font-bold text-[#ef4444]">- R$ 12.450,00</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#22c55e]/10 text-[#22c55e]">
                        Liquidado
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[#64748b]">Ontem, 15:20</td>
                    <td className="px-6 py-3.5 font-semibold text-[#0f172a]">Recebimento NF-e 4589 - Distribuidora Sul</td>
                    <td className="px-6 py-3.5 text-[#64748b]">Contas a Receber</td>
                    <td className="px-6 py-3.5 text-right font-bold text-[#22c55e]">+ R$ 8.900,00</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#22c55e]/10 text-[#22c55e]">
                        Recebido
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[#64748b]">Amanhã, 10:00</td>
                    <td className="px-6 py-3.5 font-semibold text-[#0f172a]">Impostos Federais - DARF Simples</td>
                    <td className="px-6 py-3.5 text-[#64748b]">Tributário</td>
                    <td className="px-6 py-3.5 text-right font-bold text-[#ef4444]">- R$ 45.120,00</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f59e0b]/10 text-[#f59e0b]">
                        Agendado
                      </span>
                    </td>
                  </tr>
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
                <span className="font-semibold">Conectado ao Protheus</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCopilotMessages([
              {
                role: 'assistant',
                text: 'Olá! Sou seu parceiro analítico conectado ao Protheus. Em que posso ajudar hoje?',
                suggestions: ['Resumo do faturamento', 'Duplicatas em aberto', 'Últimos pedidos']
              }
            ])}
            className="p-1.5 text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg transition-colors"
            title="Limpar conversa"
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
                      className="px-2.5 py-1 rounded-full bg-white border border-[#e2e8f0] text-[11px] font-semibold text-[#004fce] hover:bg-[#e0ecff] transition-all flex items-center gap-1 shadow-sm"
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
              <span>Consultando Oracle Protheus via QueryRest...</span>
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
              placeholder="Pergunte ao Protheus..."
              rows={2}
              className="w-full pl-3 pr-10 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[13px] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#004fce]/20 focus:border-[#004fce] resize-none"
            />
            <button
              type="submit"
              disabled={!copilotQuestion.trim() || isCopilotLoading}
              className="absolute right-2 bottom-3 p-1.5 bg-[#004fce] text-white rounded-lg hover:bg-[#003ea6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  Paperclip,
  Trash2,
  Database,
  Code2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Volume2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useExecutive } from '../../contexts/ExecutiveContext';
import { CopilotMessage } from '../../types/executive';

export default function ExecutiveCopilotPanel() {
  const {
    copilotOpen,
    setCopilotOpen,
    messages,
    isThinking,
    currentReasoningStep,
    activeReasoningSteps,
    sendMessage,
    clearChat,
  } = useExecutive();

  const [inputVal, setInputVal] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedSqlModal, setSelectedSqlModal] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!inputVal.trim() || isThinking) return;
    sendMessage(inputVal);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: 'Análise de Faturamento', query: 'Gerar análise executiva do faturamento MTD por filial e margem de contribuição.' },
    { label: 'Fluxo de Caixa 30d', query: 'Qual a projeção de liquidez e fluxo de caixa nos próximos 30 dias na tesouraria?' },
    { label: 'Comparar Filiais', query: 'Comparar desempenho de receita, EBITDA e giro de estoque entre as filiais SP, Campinas e Santos.' },
    { label: 'Risco de Inadimplência', query: 'Listar clientes com títulos em atraso no módulo SE1 e risco de crédito acima do limite.' },
    { label: 'Giro de Estoque SB2', query: 'Quais itens do almoxarifado estão em ponto crítico de ressuprimento ou sem giro há mais de 90 dias?' },
    { label: 'Curva ABC de Vendas', query: 'Apresentar a curva ABC de clientes e produtos mais relevantes no resultado operacional.' },
  ];

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setInputVal('Quais filiais tiveram a maior margem EBITDA este mês e qual a projeção para o fechamento?');
      }, 2500);
    } else {
      setIsRecording(false);
    }
  };

  if (!copilotOpen) return null;

  return (
    <aside
      id="executive-copilot-aside"
      className="w-full xl:w-[420px] 2xl:w-[460px] h-[calc(100vh-5rem)] sticky top-20 glass-card border-l border-slate-200/80 dark:border-slate-800 flex flex-col justify-between z-30 transition-all duration-300"
    >
      {/* 1. COPILOT HEADER */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F66FF] to-[#15396B] text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Protheus Copiloto
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                Online
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
              <Cpu className="w-2.5 h-2.5 text-blue-500" />
              <span>Gemini 1.5 Pro · Local LLM Backup</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            title="Limpar Conversa"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCopilotOpen(false)}
            title="Recolher Painel"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. CHAT THREAD AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Quick Actions Bar */}
        <div className="space-y-1.5 pb-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Ações Rápidas de Diretoria
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.query)}
                className="px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 hover:bg-[#0F66FF] hover:text-white dark:hover:bg-[#0F66FF] text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 transition-all text-left truncate max-w-full"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
          >
            <div
              className={`max-w-[92%] rounded-2xl p-3.5 text-xs ${
                msg.role === 'user'
                  ? 'bg-[#0F66FF] text-white shadow-md shadow-[#0F66FF]/20 font-medium'
                  : 'bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
              }`}
            >
              {/* Reasoning Steps Collapsible for Assistant */}
              {msg.role === 'assistant' && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <button
                    onClick={() => toggleReasoning(msg.id)}
                    className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Raciocínio & Validação de Leitura ERP ({msg.reasoningSteps.length} etapas)
                    </span>
                    {expandedReasoning[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedReasoning[msg.id] && (
                    <div className="mt-1.5 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {msg.reasoningSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Message Body */}
              <div className="markdown-body prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>

              {/* KPI highlight pills if returned */}
              {msg.kpis && msg.kpis.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-2 gap-1.5">
                  {msg.kpis.map((kpi, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 text-center"
                    >
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">{kpi.label}</div>
                      <div className="text-xs font-black text-slate-900 dark:text-white" style={{ color: kpi.color }}>
                        {kpi.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SQL Inspector Trigger */}
              {msg.sqlQuery && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">QueryRest Segura</span>
                  <button
                    onClick={() => setSelectedSqlModal(msg.sqlQuery || '')}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#0F66FF] dark:text-blue-400 hover:underline"
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Ver SQL Oracle</span>
                  </button>
                </div>
              )}
            </div>

            {/* Suggested Follow-up Questions */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="space-y-1 w-full pl-2">
                <div className="text-[10px] font-bold text-slate-400">Sugestões de Aprofundamento:</div>
                <div className="space-y-1">
                  {msg.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left p-1.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-medium transition-colors line-clamp-1 border border-slate-200/50 dark:border-slate-700/50"
                    >
                      → {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Live Thinking / Reasoning Animation */}
        {isThinking && (
          <div className="flex flex-col items-start space-y-2 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F66FF] dark:text-blue-400">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Consultando Protheus QueryRest...</span>
            </div>
            {currentReasoningStep && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{currentReasoningStep}</p>
            )}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 3. PROMPT INPUT AREA */}
      <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
        {/* Voice recording waveform banner if active */}
        {isRecording && (
          <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Ouvindo comando de voz executivo...</span>
            </div>
            <Volume2 className="w-4 h-4" />
          </div>
        )}

        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-[#0F66FF]/40 focus-within:border-[#0F66FF] transition-all">
          <textarea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte qualquer coisa sobre finanças, vendas, estoque ou caixa..."
            rows={2}
            className="w-full p-3 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none"
          />

          <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={toggleRecording}
                title="Comando de Voz"
                className={`p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                  isRecording ? 'text-rose-500' : 'hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Anexar Arquivo / Relatório"
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleSend}
              disabled={!inputVal.trim() || isThinking}
              className={`p-2 rounded-xl transition-all ${
                inputVal.trim() && !isThinking
                  ? 'bg-[#0F66FF] hover:bg-[#0E5CE0] text-white shadow-md shadow-[#0F66FF]/20'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Modo Leitura Estrita · Zero alteração de dados no Protheus
        </div>
      </div>

      {/* SQL Inspector Modal */}
      {selectedSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#0F66FF]" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Auditoria de SQL Oracle — QueryRest
                </h4>
              </div>
              <button
                onClick={() => setSelectedSqlModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
              <pre>{selectedSqlModal}</pre>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Query Validada por Query Guard
              </span>
              <button
                onClick={() => setSelectedSqlModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[#0F66FF] text-white font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

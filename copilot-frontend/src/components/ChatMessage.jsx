import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  ChevronDown, ChevronUp, Database, Filter, ExternalLink, 
  Download, TableProperties, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  Activity
} from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';

export default function ChatMessage({ message, isUser, profile = 'Negócio' }) {
  const [expandedSections, setExpandedSections] = useState(new Set());

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
          <p className="text-[15px] leading-relaxed">{message.text}</p>
        </div>
      </div>
    );
  }

  const {
    executive_summary,
    applied_filters,
    details,
    technical_sql,
    kpis,
    action_buttons,
    titulo,
    tipo_grafico,
    labels,
    datasets,
    insights,
    answer,
    data // raw data array for export
  } = message;

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const isExpanded = (section) => expandedSections.has(section);

  // Cores institucionais para gráficos
  const cores = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1'];
  
  let dataConfig = null;
  if (datasets && labels) {
    dataConfig = {
      labels: labels,
      datasets: datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.dados,
        backgroundColor: tipo_grafico === 'pie' ? cores : cores[0],
        borderColor: cores[0],
        borderWidth: 1,
      })),
    };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
    },
  };

  // Renderiza a cor do KPI
  const getKpiColor = (color) => {
    switch (color) {
      case 'red': return 'bg-red-50 text-red-700 border-red-200';
      case 'green': return 'bg-green-50 text-green-700 border-green-200';
      case 'yellow': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getKpiIcon = (color) => {
    switch (color) {
      case 'red': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'green': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'yellow': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const exportToExcel = () => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        alert("Não há dados estruturados para exportar.");
        return;
    }
    
    // Converter o array de objetos 'data' para CSV (separado por ;)
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(';'),
        ...data.map(row => headers.map(header => {
            const val = row[header];
            // Escapar aspas e campos com ponto-e-vírgula
            if (val === null || val === undefined) return '';
            const strVal = String(val).replace(/"/g, '""');
            if (strVal.includes(';') || strVal.includes('\n')) return `"${strVal}"`;
            return strVal;
        }).join(';'))
    ].join('\n');
    
    // Adicionar BOM para Excel abrir UTF-8 corretamente
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'exportacao_copilot.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAction = (btn) => {
    // Comunicação com o WebClient do Protheus via postMessage
    if (btn.action === 'open_routine') {
      window.parent.postMessage({ type: 'cprot-open-routine', routine: btn.payload }, '*');
    }
    
    if (btn.action === 'export_excel') {
      exportToExcel();
    }
  };

  return (
    <div className="flex justify-start mb-6">
      <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-sm w-full shadow-sm max-w-[95%]">
        
        {/* Camada 1: Resumo Executivo / Mensagem Principal */}
        <div className="prose prose-sm prose-blue max-w-none text-slate-700 mb-4">
          <ReactMarkdown>{executive_summary || answer}</ReactMarkdown>
        </div>

        {/* Camada 2: KPIs */}
        {kpis && kpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className={`flex flex-col p-3 rounded-lg border ${getKpiColor(kpi.color)}`}>
                <span className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5 opacity-80">
                  {getKpiIcon(kpi.color)}
                  {kpi.label}
                </span>
                <span className="text-lg font-bold">{kpi.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Camada 3: Gráfico (se houver) */}
        {tipo_grafico && datasets && (
          <div className="mb-4">
            {titulo && <h4 className="text-sm font-bold text-slate-800 mb-2">{titulo}</h4>}
            <div className="min-h-[200px] max-h-80 w-full flex items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-100">
              {tipo_grafico === 'bar' && <Bar data={dataConfig} options={chartOptions} />}
              {tipo_grafico === 'line' && <Line data={dataConfig} options={chartOptions} />}
              {tipo_grafico === 'pie' && <Pie data={dataConfig} options={chartOptions} />}
            </div>
            {insights && (
              <div className="mt-2 text-xs text-slate-600 bg-blue-50/50 p-2 rounded flex gap-2 items-start">
                <span className="text-blue-500">💡</span>
                <span>{insights}</span>
              </div>
            )}
          </div>
        )}

        {/* Camada 4: Acordeões (Filtros, Detalhes, Técnico) */}
        <div className="flex flex-col gap-2 mb-4 border-t border-slate-100 pt-4 mt-2">
          
          {/* Filtros Usados */}
          {applied_filters && applied_filters.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button 
                onClick={() => toggleSection('filters')}
                className="flex items-center justify-between w-full p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Filter className="w-4 h-4 text-slate-500" />
                  Filtros Aplicados
                </div>
                {isExpanded('filters') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {isExpanded('filters') && (
                <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap gap-2">
                  {applied_filters.map((f, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detalhamento */}
          {details && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button 
                onClick={() => toggleSection('details')}
                className="flex items-center justify-between w-full p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TableProperties className="w-4 h-4 text-slate-500" />
                  Detalhamento
                </div>
                {isExpanded('details') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {isExpanded('details') && (
                <div className="p-4 bg-white border-t border-slate-200 prose prose-sm max-w-none prose-table:w-full prose-th:bg-slate-50 prose-td:border-b prose-td:border-slate-100">
                  <ReactMarkdown>{details}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* Consulta Técnica (Apenas se perfil não for puramente de Negócio, ou sempre oculto por padrão) */}
          {technical_sql && profile !== 'Negócio' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button 
                onClick={() => toggleSection('sql')}
                className="flex items-center justify-between w-full p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Database className="w-4 h-4 text-slate-500" />
                  Consulta SQL (Técnico)
                </div>
                {isExpanded('sql') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {isExpanded('sql') && (
                <div className="p-0 bg-slate-900 border-t border-slate-200">
                  <pre className="p-4 text-xs text-green-400 overflow-x-auto m-0 font-mono">
                    {technical_sql}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Camada 5: Botões de Ação */}
        {action_buttons && action_buttons.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-slate-100">
            {action_buttons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(btn)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 transition-colors shadow-sm"
              >
                {btn.action === 'export_excel' && <Download className="w-4 h-4" />}
                {btn.action === 'open_routine' && <ExternalLink className="w-4 h-4" />}
                {!['export_excel', 'open_routine'].includes(btn.action) && <CheckCircle2 className="w-4 h-4" />}
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Trilha de Auditoria (Footer) */}
        {message.audit_trail && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-300" />
              {message.audit_trail.records_returned} registros avaliados
            </span>
            <span>
              ⚡ {(message.audit_trail.elapsed_ms / 1000).toFixed(1)}s via {message.audit_trail.backend === 'gemini' ? 'Google Gemini' : 'Local AI'}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Database,
  ExternalLink,
} from 'lucide-react';
import {
  TOP_PRODUCTS_DATA,
  CLIENT_RISK_DATA,
} from '../../data/executiveData';
import { ProductPerformance, ClientRiskScore } from '../../types/executive';

export default function EnterpriseDataGrids() {
  const [activeTab, setActiveTab] = useState<'products' | 'clients'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filtered Products
  const filteredProducts = TOP_PRODUCTS_DATA.filter(
    p =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtered Clients
  const filteredClients = CLIENT_RISK_DATA.filter(
    c =>
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm)
  );

  const exportCsv = () => {
    let headers = '';
    let rows = '';

    if (activeTab === 'products') {
      headers = 'Código,Descrição,Categoria,Receita,Unidades,Margem%,Saldo Estoque,Status\n';
      rows = filteredProducts
        .map(
          p =>
            `"${p.code}","${p.description}","${p.category}",${p.revenue},${p.unitsSold},${p.avgMargin},${p.stockBalance},"${p.status}"`
        )
        .join('\n');
    } else {
      headers = 'Código,Cliente,CNPJ,Limite Crédito,Saldo Aberto,Vencido 30d,Rating,Status\n';
      rows = filteredClients
        .map(
          c =>
            `"${c.code}","${c.name}","${c.cnpj}",${c.creditLimit},${c.openBalance},${c.overdue30d},"${c.riskRating}","${c.status}"`
        )
        .join('\n');
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `protheus_${activeTab}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section id="enterprise-datagrids-section" className="rounded-3xl glass-card p-5 sm:p-6 space-y-4">
      {/* Table Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Tabelas de Inteligência Operacional (Notion & Airtable Standard)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registros brutos extraídos com menor privilégio e mascaramento de dados sensíveis.
            </p>
          </div>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('products');
                setSearchTerm('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'products'
                  ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Ranking de Produtos (SD2/SB1)
            </button>
            <button
              onClick={() => {
                setActiveTab('clients');
                setSearchTerm('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'clients'
                  ? 'bg-white dark:bg-slate-700 text-[#0F66FF] dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Exposição de Risco (SA1/SE1)
            </button>
          </div>

          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs hover:bg-slate-800 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'products'
                ? 'Filtrar por código B1_COD, descrição ou categoria...'
                : 'Filtrar por razão social, código A1_COD ou CNPJ...'
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F66FF]/40"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
        {activeTab === 'products' ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Item Protheus</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Faturamento (MTD)</th>
                <th className="py-3 px-4 text-right">Unidades</th>
                <th className="py-3 px-4 text-right">Margem %</th>
                <th className="py-3 px-4 text-right">Saldo SB2</th>
                <th className="py-3 px-4 text-center">Status de Giro</th>
                <th className="py-3 px-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map(prod => (
                <React.Fragment key={prod.code}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === prod.code ? null : prod.code)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#0F66FF] bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                          {prod.code}
                        </span>
                        <span>{prod.description}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{prod.category}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                      R$ {(prod.revenue / 1000).toFixed(0)}k
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 font-mono">
                      {prod.unitsSold.toLocaleString()} un
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {prod.avgMargin}%
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 font-mono">
                      {prod.stockBalance} un
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          prod.status === 'Alta Demanda'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : prod.status === 'Estoque Crítico'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : prod.status === 'Margem Saudável'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {prod.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400">
                      {expandedRow === prod.code ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                  </tr>

                  {/* Expanded Row Detail */}
                  {expandedRow === prod.code && (
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="font-bold text-slate-500">Filial Atribuída:</span>{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{prod.branch}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-500">Dias de Cobertura:</span>{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{prod.stockTurnoverDays} dias</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-500">Origem Dicionário:</span>{' '}
                            <span className="font-mono text-blue-500">SB1010 (B1_TIPO='PA')</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Cliente / Razão Social</th>
                <th className="py-3 px-4">CNPJ</th>
                <th className="py-3 px-4 text-right">Limite de Crédito</th>
                <th className="py-3 px-4 text-right">Saldo Aberto (SE1)</th>
                <th className="py-3 px-4 text-right">Atraso &gt; 30d</th>
                <th className="py-3 px-4 text-center">Rating Risco</th>
                <th className="py-3 px-4 text-center">Status Alçada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClients.map(client => (
                <tr key={client.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#0F66FF] bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                        {client.code}
                      </span>
                      <span>{client.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{client.cnpj}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    R$ {(client.creditLimit / 1000).toFixed(0)}k
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                    R$ {(client.openBalance / 1000).toFixed(1)}k
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-bold ${
                      client.overdue30d > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {client.overdue30d > 0 ? `R$ ${(client.overdue30d / 1000).toFixed(1)}k` : 'R$ 0,00'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        client.riskRating.startsWith('A')
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : client.riskRating.startsWith('B')
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {client.riskRating}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        client.status === 'Liberado'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : client.status === 'Em Alerta'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

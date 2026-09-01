import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  ChevronDown,
  Search,
  Calendar,
  Bell,
  Moon,
  Sun,
  Download,
  Bot,
  Layers,
  TrendingUp,
  FileText,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';
import { useExecutive } from '../../contexts/ExecutiveContext';

export default function ExecutiveHeader() {
  const {
    isDark,
    toggleTheme,
    companies,
    selectedCompany,
    setSelectedCompany,
    selectedBranch,
    setSelectedBranch,
    timeRange,
    setTimeRange,
    copilotOpen,
    setCopilotOpen,
    setCommandPaletteOpen,
    setExportModalOpen,
  } = useExecutive();

  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const periods = [
    'Hoje (Tempo Real)',
    'Últimos 7 Dias',
    'MTD (Agosto 2026)',
    'Q3 2026 Consolidado',
    'YTD (Ano até a Data)',
    'Exercício 2025 vs 2026',
  ];

  return (
    <header
      id="executive-main-header"
      className="sticky top-0 z-40 h-20 w-full glass-header border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200"
    >
      <div className="h-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand & ERP Status */}
        <div className="flex items-center gap-4 min-w-max">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#0F66FF] via-[#1E40AF] to-[#15396B] text-white shadow-lg shadow-[#0F66FF]/25 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>PROTHEUS</span>
                  <span className="text-[#0F66FF] dark:text-[#38BDF8]">COPILOTO EXECUTIVO</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#0F66FF]/10 dark:bg-[#0F66FF]/20 text-[#0F66FF] dark:text-blue-400 border border-[#0F66FF]/20">
                  <Lock className="w-2.5 h-2.5" /> READ-ONLY
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Inteligência de Negócios</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  TOTVS Protheus 12.1.2410
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Center: Global Command Search & Company Selector */}
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-2xl justify-center">
          {/* Company & Branch Selector */}
          <div className="relative">
            <button
              id="company-branch-selector-btn"
              onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 hover:border-[#0F66FF]/50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all"
            >
              <Building2 className="w-4 h-4 text-[#0F66FF]" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold leading-none">
                  Empresa / Filial
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {selectedCompany.code} · {selectedBranch.name}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {companyDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setCompanyDropdownOpen(false)}
              >
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Selecionar Entidade do Grupo
                </div>
                {companies.map(comp => (
                  <div key={comp.id} className="py-1">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {comp.name}
                    </div>
                    {comp.branches.map(branch => (
                      <button
                        key={branch.id}
                        onClick={() => {
                          setSelectedCompany(comp);
                          setSelectedBranch(branch);
                          setCompanyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          selectedBranch.id === branch.id
                            ? 'bg-[#0F66FF] text-white font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-mono text-[11px] opacity-75 mr-1.5">[{branch.code}]</span>
                          {branch.name}
                        </div>
                        <span className="text-[10px] opacity-80">{branch.city}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Global Search / Command Bar */}
          <button
            id="global-command-palette-trigger"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex-1 flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-[#0F66FF]/50 text-slate-500 dark:text-slate-400 text-xs shadow-inner transition-all group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-[#0F66FF] transition-colors" />
              <span className="truncate">Buscar KPI, cliente, nota fiscal, produto ou insight...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-semibold shadow-xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Section: Time Range, Notifications, Theme, Profile, Copilot Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Time Range Selector */}
          <div className="relative hidden sm:block">
            <button
              id="period-selector-btn"
              onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs hover:border-[#0F66FF]/50 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-[#0F66FF]" />
              <span className="hidden xl:inline">{timeRange}</span>
              <span className="xl:hidden">MTD</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {periodDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setPeriodDropdownOpen(false)}
              >
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Janela Temporal Executiva
                </div>
                {periods.map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setTimeRange(p);
                      setPeriodDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      timeRange === p
                        ? 'bg-[#0F66FF] text-white font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Briefing Button */}
          <button
            id="export-executive-report-btn"
            onClick={() => setExportModalOpen(true)}
            title="Exportar Relatório Executivo em PDF / Excel"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-bold shadow-md shadow-slate-900/10 transition-transform active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Exportar Briefing</span>
          </button>

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Alternar Tema Claro / Escuro"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Executive Notifications Popover */}
          <div className="relative">
            <button
              id="executive-notifications-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Alertas Executivos"
              className="relative p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
            </button>

            {notificationsOpen && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-3 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setNotificationsOpen(false)}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">Alertas do Protheus</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold">2 críticos</span>
                </div>
                <div className="py-2 space-y-2">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                    <p className="font-bold text-red-800 dark:text-red-300 text-[11px]">Risco de Crédito: CLI-0041</p>
                    <p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5">Metalúrgica Paulista atingiu 82% do limite com R$ 24k em atraso.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                    <p className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">Estoque Baixo: Válvula Inox 316</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Saldo cobre apenas 14 dias de demanda média no almoxarifado SP.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Copilot Drawer */}
          <button
            id="toggle-copilot-panel-btn"
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              copilotOpen
                ? 'bg-[#0F66FF] text-white border-[#0F66FF] shadow-md shadow-[#0F66FF]/25'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-[#0F66FF]/40'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden md:inline">Copiloto</span>
          </button>

          {/* Executive Profile Avatar */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-700">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#15396B] to-[#0F66FF] text-white font-bold flex items-center justify-center text-xs shadow-md ring-2 ring-[#0F66FF]/20">
              MG
            </div>
            <div className="hidden 2xl:block text-left">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Murilo Góis</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Diretoria Executiva</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

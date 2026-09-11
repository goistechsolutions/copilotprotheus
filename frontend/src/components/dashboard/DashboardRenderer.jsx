import React from 'react';

/**
 * Dashboard Engine Renderer
 * Contrato universal de renderização da IA. Recebe o payload e delega
 * para as camadas de visualização correspondentes dependendo do screenType.
 */
export default function DashboardRenderer({ payload }) {
  if (!payload) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Nenhum dado recebido. Peça algo ao Copiloto.</p>
      </div>
    );
  }

  const { screenType, data } = payload;

  // No futuro, os componentes especializados serão carregados aqui
  // ex: const FinancialDashboard = lazy(() => import('./types/FinancialDashboard'));
  
  switch (screenType) {
    case 'financial-dashboard':
    case 'commercial-dashboard':
    case 'inventory-dashboard':
    case 'comparison-dashboard':
    case 'forecast-dashboard':
    case 'executive-dashboard':
    default:
      // Fallback genérico para a camada de apresentação provisória
      return (
        <div className="flex h-full flex-col gap-6 p-6">
          <header>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
              {screenType ? screenType.replace('-', ' ') : 'Dashboard Genérico'}
            </h1>
            <p className="text-slate-500">Renderizado através do Dashboard Engine</p>
          </header>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Espaço reservado para KPIs */}
            <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">KPIs (Em breve)</div>
            <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">KPIs (Em breve)</div>
            <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">KPIs (Em breve)</div>
            <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">KPIs (Em breve)</div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
             {/* Espaço reservado para Charts */}
             <div className="h-64 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">Charts Area</div>
             <div className="h-64 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">Insights Area</div>
          </div>

          <div className="h-96 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/30">
            Tabela de Dados (DataGrid)
          </div>
        </div>
      );
  }
}

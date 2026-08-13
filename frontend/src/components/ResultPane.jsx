import React from 'react'
import { Activity, Clock, Database, BarChart3 } from 'lucide-react'
import ResultsTable from './ResultsTable'

export default function ResultPane({ result }) { 
    if (!result) return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 h-full">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                <BarChart3 size={24} className="text-slate-600" />
            </div>
            <p className="text-sm">Aguardando primeira consulta.</p>
        </div>
    ); 
    
    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <Database size={16} className="text-emerald-400" />
                    <strong className="text-slate-200 text-sm font-semibold">{result.title || 'Resultado da Análise'}</strong>
                </div>
            </header>
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
                {result.summary && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                        <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
                    </div>
                )}
                
                {result.data && result.data.length > 0 ? (
                    <div className="h-[400px]">
                        <ResultsTable rows={result.data} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30 text-slate-500 text-sm">
                        Painel Analítico
                    </div>
                )}
            </div>
            <footer className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-900">
                <div className="flex items-center gap-1.5"><Activity size={12}/> {result.records || result.data?.length || 0} linhas processadas</div>
                <div className="flex items-center gap-1.5"><Clock size={12}/> {result.response_time_ms || 0} ms</div>
            </footer>
        </div>
    ) 
}
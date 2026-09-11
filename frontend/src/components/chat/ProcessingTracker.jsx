import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

const PROCESSING_STEPS = [
  { id: 1, label: 'Entendendo pergunta' },
  { id: 2, label: 'Gerando consulta' },
  { id: 3, label: 'Consultando Protheus' },
  { id: 4, label: 'Analisando dados' },
  { id: 5, label: 'Gerando insights' },
  { id: 6, label: 'Montando dashboard' },
];

export function ProcessingTracker({ currentStep = 1 }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/30 text-xs w-full max-w-sm shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200/50 dark:border-blue-800/40">
        <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
        <span className="font-semibold text-blue-900 dark:text-blue-200 text-xs">
          Execução Analítica em Andamento
        </span>
      </div>

      <div className="space-y-2">
        {PROCESSING_STEPS.map((step) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isPending = step.id > currentStep;

          return (
            <div key={step.id} className="flex items-center gap-2.5 transition-all">
              {isDone && (
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              {isCurrent && (
                <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
              )}
              {isPending && (
                <Circle size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
              )}

              <span className={`transition-colors ${
                isDone 
                  ? 'text-slate-600 dark:text-slate-400 font-medium line-through decoration-slate-300' 
                  : isCurrent 
                  ? 'text-blue-900 dark:text-blue-200 font-bold' 
                  : 'text-slate-400 dark:text-slate-500 font-normal'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

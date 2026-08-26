import React from 'react';
import { BarChart2, FileText, Sparkles } from 'lucide-react';

const prompts = [
  { Icon: Sparkles, tone: 'text-blue-500', text: 'Resumo do financeiro hoje', description: 'Veja os principais indicadores do dia' },
  { Icon: FileText, tone: 'text-emerald-500', text: 'Últimas notas emitidas', description: 'Consulte documentos recentes' },
  { Icon: BarChart2, tone: 'text-purple-500', text: 'Análise de inadimplência', description: 'Identifique títulos em atraso' },
];

export default function QuickPrompts({ module, onSelect }) {
  return (
    <section aria-labelledby="quick-prompts-title">
      <p id="quick-prompts-title" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Sugestões para {module}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map(({ Icon, tone, text, description }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className="group flex min-h-[86px] items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-[0_3px_10px_rgba(40,72,105,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_8px_18px_rgba(38,112,179,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition-colors group-hover:bg-white">
              <Icon className={`h-4 w-4 ${tone}`} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold leading-snug text-slate-700 group-hover:text-blue-700">{text}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

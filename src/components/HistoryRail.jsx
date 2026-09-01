import { MessageSquare, Plus, Sparkles } from 'lucide-react';

export default function HistoryRail({ items, onSelect, onNew }) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-[#e1eaf2] bg-white">
      <div className="border-b border-[#edf2f7] p-4">
        <div className="mb-5 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eaf4fc] text-[#2879bf]">
            <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#203c60]">Copilot Protheus</p>
            <p className="text-[10px] text-[#93a3b4]">Seu espaço de trabalho</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2379c9] px-3 py-2.5 text-[12px] font-semibold text-white shadow-[0_5px_12px_rgba(35,121,201,0.18)] transition-colors hover:bg-[#176bb8] focus:outline-none focus:ring-2 focus:ring-[#2379c9]/25 active:scale-[0.99]"
        >
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          Nova conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aaabd]">
          Conversas recentes
        </p>
        <div className="space-y-1">
          {items.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              type="button"
              onClick={() => onSelect(item)}
              className="group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-[#e0edf7] hover:bg-[#f5faff] focus:outline-none focus:ring-2 focus:ring-[#2379c9]/20"
            >
              <MessageSquare size={14} className="mt-0.5 shrink-0 text-[#8ca4ba] group-hover:text-[#2879bf]" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium leading-tight text-[#4e6680] group-hover:text-[#2871ad]">
                  {item.title}
                </span>
                <span className="mt-1 block text-[10px] text-[#a1afbd]">{item.date}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#edf2f7] px-4 py-3 text-[10px] leading-relaxed text-[#9aaabd]">
        Consultas protegidas pelo contexto ativo do Protheus.
      </div>
    </aside>
  );
}

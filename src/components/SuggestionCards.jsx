import { BarChart3, CalendarDays, FileText, TrendingUp } from 'lucide-react';

const icons = [FileText, TrendingUp, CalendarDays, BarChart3];

export default function SuggestionCards({ items, disabled, onPick }) {
  return (
    <section className="w-full" aria-labelledby="suggestions-title">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p id="suggestions-title" className="text-[15px] font-semibold text-[#19385d]">
            Sugestões de consulta
          </p>
          <p className="mt-0.5 text-xs text-[#71829a]">
            Comece por uma pergunta frequente
          </p>
        </div>
        <span className="rounded-full bg-[#eef5fc] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5d7b9d]">
          Copilot IA
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, index) => {
          const Icon = icons[index % icons.length];
          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(item)}
              className="group min-h-[118px] rounded-2xl border border-[#e1eaf3] bg-white p-4 text-left shadow-[0_4px_16px_rgba(40,77,113,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b9d7f2] hover:shadow-[0_10px_24px_rgba(35,105,173,0.12)] focus:outline-none focus:ring-2 focus:ring-[#2c83d8]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5fd] text-[#2e78be] transition-colors group-hover:bg-[#dceefd]">
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <strong className="block text-[13px] font-semibold leading-snug text-[#203c60] transition-colors group-hover:text-[#176fc1]">
                {item.title}
              </strong>
              <span className="mt-1 block text-[11px] leading-relaxed text-[#8090a4]">
                {item.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

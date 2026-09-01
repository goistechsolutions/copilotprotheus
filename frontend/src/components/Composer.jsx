import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  SendHorizontal,
  CornerDownLeft,
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';

export default function Composer({ disabled, onSend, placeholder }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full">
      <div className="studio-composer relative rounded-2xl p-2.5 transition-all">
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="composer-input"
            name="composer-input"
            rows={1}
            disabled={disabled}
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Faça uma pergunta sobre faturamento, estoque, compras ou financeiro...'}
            aria-label="Prompt do Copilot Protheus"
            className="w-full resize-none bg-transparent px-3.5 pb-10 pt-2 text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: '160px', minHeight: '52px' }}
          />
        </div>

        <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-100/80">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>QueryRest Oracle • Zero Alucinação</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {value.trim() && (
              <button
                type="button"
                onClick={() => setValue('')}
                className="text-[11px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Limpar
              </button>
            )}

            <button
              type="button"
              aria-label="Enviar prompt"
              disabled={disabled || !value.trim()}
              onClick={submit}
              className="flex h-8 px-3.5 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[12px] font-semibold shadow-sm hover:from-blue-500 hover:to-purple-500 transition-all active:scale-95 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:shadow-none"
            >
              <span>Enviar</span>
              <SendHorizontal size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          <span>Modelo ativo: <strong>Gemini 2.0 Flash</strong></span>
        </span>
        <span className="hidden sm:inline">Pressione <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para quebra de linha</span>
      </div>
    </div>
  );
}

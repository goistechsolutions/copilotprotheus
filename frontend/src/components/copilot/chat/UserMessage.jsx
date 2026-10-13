import React from 'react';
import { User } from 'lucide-react';

export function UserMessage({ message }) {
  const content = typeof message === 'string' ? message : message.content;

  return (
    <div className="flex flex-col items-end w-full mb-5 animate-fade-in">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)] mb-1.5 select-none">
        <span>Você</span>
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[var(--color-text)]">
          <User size={10} />
        </div>
      </div>

      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-xs bg-[#2563eb] text-white text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
        {content}
      </div>
    </div>
  );
}

export default UserMessage;

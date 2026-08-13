import React, { useState } from 'react';
import { SendHorizontal, Mic, Paperclip } from 'lucide-react';

export default function Composer({ disabled, onSend, placeholder }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative group">
      <textarea
        id="composer-input"
        name="composer-input"
        rows={2}
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-[24px] py-4 pl-4 pr-14 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      />
      <div className="absolute left-4 bottom-3 flex gap-2">
         <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full"><Mic size={18} /></button>
         <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full"><Paperclip size={18} /></button>
      </div>
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={submit}
        className="absolute right-3 bottom-3 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-sm"
      >
        <SendHorizontal size={18} />
      </button>
    </div>
  );
}
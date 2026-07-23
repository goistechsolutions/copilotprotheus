import React, { useState } from 'react'
import { SendHorizontal } from 'lucide-react'

export default function Composer({ disabled, onSend, placeholder }) { 
    const [value, setValue] = useState(''); 
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !disabled) {
                onSend(value);
                setValue('');
            }
        }
    };
    
    return (
        <div className="w-full max-w-3xl mx-auto relative group">
            <textarea 
                rows={2} 
                disabled={disabled} 
                value={value} 
                onChange={e=>setValue(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder={placeholder} 
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 pl-4 pr-14 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
            />
            <button 
                disabled={disabled || !value.trim()} 
                onClick={() => { onSend(value); setValue('') }}
                className="absolute right-3 bottom-3 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400 transition-colors"
            >
                <SendHorizontal size={18} />
            </button>
        </div>
    ) 
}
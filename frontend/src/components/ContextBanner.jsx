import React from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function ContextBanner({ state }) { 
    const isOk = state.ready;
    const isConnecting = state.message.toLowerCase().includes('conectando');
    const isFail = !isOk && !isConnecting;
    
    return (
        <div className={`w-full text-xs font-medium px-4 py-2 flex items-center gap-2 justify-center transition-colors duration-300 shadow-sm z-20 ${isOk ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20' : isFail ? 'bg-rose-500/10 text-rose-400 border-b border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border-b border-blue-500/20'}`}>
            {isOk && <CheckCircle2 size={14} />}
            {isConnecting && <Loader2 size={14} className="animate-spin" />}
            {isFail && <AlertCircle size={14} />}
            {state.message}
        </div>
    ) 
}
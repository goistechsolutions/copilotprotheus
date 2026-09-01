import React from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function ContextBanner({ state }) { 
    const isOk = state.ready;
    const isConnecting = state.message.toLowerCase().includes('conectando');
    const isFail = !isOk && !isConnecting;
    
    return (
        <div className={`text-sm font-medium flex items-center gap-2 mb-4 ${isOk ? 'text-slate-600' : isFail ? 'text-rose-500' : 'text-blue-500'}`}>
            {isOk && <CheckCircle2 size={16} className="text-emerald-500" />}
            {isConnecting && <Loader2 size={16} className="animate-spin text-blue-500" />}
            {isFail && <AlertCircle size={16} className="text-rose-500" />}
            {state.message}
        </div>
    ) 
}
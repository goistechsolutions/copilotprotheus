import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, User } from 'lucide-react'

export default function Conversation({ messages }) { 
    return (
        <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col gap-6 py-4">
            {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${m.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                        {m.role === 'user' ? <User size={16} className="text-white"/> : <Bot size={16} className="text-white"/>}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-700 text-slate-100 rounded-tl-sm border border-slate-600/50'}`}>
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                </div>
            ))}
        </div>
    ) 
}
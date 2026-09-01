import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Sparkles, Copy, Check, Terminal } from 'lucide-react';

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, '');

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 border-b border-slate-700/50 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#0F66FF]" />
          <span>Oracle SQL / Protheus</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <pre className="p-3 text-[12px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export default function Conversation({ messages }) {
  if (!messages?.length) return null;

  return (
    <div className="flex w-full flex-col gap-3.5 py-1" aria-live="polite">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';

        return (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F66FF] to-indigo-600 text-white shadow-xs">
                <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
              </div>
            )}

            <div
              className={`max-w-[min(90%,680px)] rounded-2xl px-4 py-3 text-[13px] leading-relaxed transition-all ${
                isUser
                  ? 'rounded-tr-xs bg-[#0F66FF] text-white shadow-xs'
                  : 'exec-card rounded-tl-xs text-[#162D52] dark:text-slate-200'
              }`}
            >
              {!isUser && (
                <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1 text-[10px]">
                  <div className="flex items-center gap-1.5 font-bold text-[#0F66FF] dark:text-[#3882FF]">
                    <span>Copiloto Executivo</span>
                    <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 text-[9px] font-semibold text-[#0F66FF] dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                      Gemini 2.0 Flash
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">TOTVS Oracle</span>
                </div>
              )}

              <div
                className={`prose max-w-none text-[13px] leading-relaxed ${
                  isUser
                    ? 'prose-invert prose-p:text-white prose-strong:text-white prose-code:text-white prose-a:text-blue-100'
                    : 'prose-slate dark:prose-invert prose-p:text-[#162D52] dark:prose-p:text-slate-200 prose-headings:text-[#162D52] dark:prose-headings:text-white prose-strong:text-[#162D52] dark:prose-strong:text-white prose-code:text-[#0F66FF] dark:prose-code:text-blue-300 prose-code:bg-blue-50/70 dark:prose-code:bg-blue-950/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px]'
                } prose-p:my-1 prose-headings:mb-1.5 prose-headings:mt-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-2 prose-code:before:content-none prose-code:after:content-none`}
              >
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline ? (
                        <CodeBlock className={className}>{children}</CodeBlock>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            </div>

            {isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs">
                <User size={15} strokeWidth={2} aria-hidden="true" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

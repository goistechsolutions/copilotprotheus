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
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/50 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
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
    <div className="flex w-full flex-col gap-4 py-2" aria-live="polite">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';

        return (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/10">
                <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
              </div>
            )}

            <div
              className={`max-w-[min(90%,720px)] rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed transition-all ${
                isUser
                  ? 'rounded-tr-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/10'
                  : 'studio-card rounded-tl-sm text-slate-700'
              }`}
            >
              {!isUser && (
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                    <span>Copilot Protheus AI</span>
                    <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-600 border border-indigo-200/50">
                      Gemini 2.0 Flash
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">TOTVS Oracle</span>
                </div>
              )}

              <div
                className={`prose max-w-none text-[13px] leading-relaxed ${
                  isUser
                    ? 'prose-invert prose-p:text-white prose-strong:text-white prose-code:text-white prose-a:text-indigo-200'
                    : 'prose-slate prose-p:text-slate-700 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-code:text-indigo-700 prose-code:bg-indigo-50/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px]'
                } prose-p:my-1.5 prose-headings:mb-2 prose-headings:mt-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-table:my-2 prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2 prose-code:before:content-none prose-code:after:content-none`}
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-600 shadow-sm">
                <User size={16} strokeWidth={2} aria-hidden="true" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

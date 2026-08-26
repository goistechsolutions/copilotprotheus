import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';

export default function Conversation({ messages }) {
  if (!messages.length) return null;

  return (
    <div className="flex w-full flex-col gap-5 py-2" aria-live="polite">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';

        return (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#d7e8f6] bg-[#edf6fd] text-[#2b78bc]">
                <Bot size={16} strokeWidth={1.8} aria-hidden="true" />
              </div>
            )}

            <div
              className={`max-w-[min(88%,680px)] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-[0_3px_12px_rgba(49,84,117,0.05)] ${
                isUser
                  ? 'rounded-br-md border border-[#cde3f7] bg-[#eaf4fd] text-[#245c8e]'
                  : 'rounded-bl-md border border-[#e1eaf2] bg-white text-[#3f5872]'
              }`}
            >
              <div
                className={`prose max-w-none text-[13px] leading-relaxed ${
                  isUser
                    ? 'prose-p:text-[#245c8e] prose-strong:text-[#1f4f7c] prose-code:text-[#245c8e]'
                    : 'prose-slate prose-p:text-[#3f5872] prose-headings:text-[#203c60] prose-strong:text-[#203c60] prose-code:text-[#285f8e]'
                } prose-p:my-0 prose-headings:mb-2 prose-headings:mt-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:rounded-xl prose-pre:bg-[#f3f7fb] prose-pre:text-[#28445f] prose-code:before:content-none prose-code:after:content-none`}
              >
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            </div>

            {isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#dce7f2] bg-[#f5f8fb] text-[#6d89a5]">
                <User size={15} strokeWidth={1.8} aria-hidden="true" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

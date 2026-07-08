import React from 'react';

export default function MarkdownText({ text }) {
  if (!text) return null;

  // Split por blocos de código
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="markdown-content">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.split('\n');
          const firstLine = lines[0].replace('```', '').trim();
          const language = firstLine || 'code';
          const code = lines.slice(1, -1).join('\n');
          return (
            <div key={idx} className="code-block-wrapper">
              <div className="code-block-header">
                <span className="code-lang">{language}</span>
                <button 
                  className="code-copy-btn" 
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  Copiar
                </button>
              </div>
              <pre className="code-block">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Formatação de linhas e blocos comuns
        const sublines = part.split('\n');
        return (
          <div key={idx} className="text-block">
            {sublines.map((line, lIdx) => {
              const trimmed = line.trim();
              
              // Listas / Bullet points
              if (trimmed.startsWith('- ')) {
                return <li key={lIdx} className="md-list-item">{formatInline(trimmed.substring(2))}</li>;
              }
              
              // Títulos
              if (line.startsWith('### ')) {
                return <h4 key={lIdx} className="md-h4">{formatInline(line.substring(4))}</h4>;
              }
              if (line.startsWith('## ')) {
                return <h3 key={lIdx} className="md-h3">{formatInline(line.substring(3))}</h3>;
              }
              if (line.startsWith('# ')) {
                return <h2 key={lIdx} className="md-h2">{formatInline(line.substring(2))}</h2>;
              }

              // Linha vazia
              if (trimmed === '') {
                return <div key={lIdx} className="md-spacing" />;
              }

              // Parágrafo padrão
              return <p key={lIdx} className="md-para">{formatInline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function formatInline(str) {
  // Regex para negrito **text** e código em linha `code`
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="md-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="md-inline-code">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

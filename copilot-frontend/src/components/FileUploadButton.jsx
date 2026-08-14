import React from 'react';
import { Paperclip } from 'lucide-react';

const ACCEPTED_TYPES = '.pdf,.csv,.xlsx,.xls,.txt,.png,.jpg,.jpeg';
const MAX_SIZE_MB = 10;

export default function FileUploadButton({ inputRef, onFileSelect }) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Arquivo muito grande. Limite de ${MAX_SIZE_MB}MB.`);
      e.target.value = '';
      return;
    }
    onFileSelect(e);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
        title="Anexar arquivo para análise"
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
}

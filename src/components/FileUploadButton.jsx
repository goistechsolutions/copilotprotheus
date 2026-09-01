import React from 'react';
import { Paperclip } from 'lucide-react';

export default function FileUploadButton({ inputRef, onFileSelect }) {
  return (
    <>
      <input 
        type="file" 
        ref={inputRef} 
        onChange={onFileSelect} 
        className="hidden" 
      />
      <button 
        type="button" 
        onClick={() => inputRef.current?.click()}
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
        title="Anexar arquivo"
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
}

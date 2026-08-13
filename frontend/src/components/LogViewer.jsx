import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function LogViewer({ onClose }) {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    setLogs([{ message: 'Conectando ao stream de logs do Protheus Backend...', timestamp: Date.now() / 1000 }]);
    
    const es = new EventSource(`${API_BASE}/agent/stream-logs`);
    
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => {
           const newLogs = [...prev, data];
           return newLogs.slice(-200);
        });
      } catch (err) {
        console.error("Erro no log stream parse:", err);
      }
    };
    
    es.onerror = (err) => {
      console.error("SSE connection error", err);
      setLogs(prev => [...prev, { message: 'Erro de conexão com stream. Tentando reconectar...', timestamp: Date.now() / 1000 }]);
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-emerald-400 font-mono text-xs shadow-2xl relative border-t-2 border-emerald-500/50">
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-500" />
          <span className="font-semibold tracking-wider uppercase text-slate-300">Terminal do Agente</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.map((log, i) => {
           const date = new Date(log.timestamp * 1000);
           const timeStr = date.toLocaleTimeString('pt-BR', { hour12: false, fractionalSecondDigits: 3 });
           
           return (
             <div key={i} className="break-all opacity-90 hover:opacity-100 hover:bg-slate-900/50 p-0.5 rounded">
                <span className="text-slate-600 mr-2">[{timeStr}]</span>
                <span className={log.message.includes('ERROR') ? 'text-red-400' : log.message.includes('WARNING') ? 'text-yellow-400' : 'text-emerald-300'}>
                  {log.message}
                </span>
             </div>
           );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react'
export default function MessageList({ messages, loading }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  return (
    <div className="msg-list" role="log" aria-live="polite">
      {messages.map((m, i) => (
        <div key={i} className={`bubble ${m.role}`}>
          {m.role === 'assistant' && <span className="bubble-role">Copilot</span>}
          <p>{m.text}</p>
        </div>
      ))}
      {loading && (
        <div className="bubble assistant">
          <span className="bubble-role">Copilot</span>
          <p className="typing"><span /><span /><span /></p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

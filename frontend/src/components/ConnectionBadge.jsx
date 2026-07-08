import React from 'react'
export default function ConnectionBadge({ ok }) {
  return (
    <div className={`conn-badge ${ok ? 'online' : 'offline'}`} role="status" aria-live="polite">
      <span className="conn-dot" /> {ok ? 'Backend conectado' : 'Sem conexão com backend'}
    </div>
  )
}

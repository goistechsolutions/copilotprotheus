import React from 'react'
export default function FloatingButton({ onClick, unread = 0 }) {
  return (
    <button className="fab" onClick={onClick} aria-label="Abrir Copilot Protheus" title="Abrir Copilot Protheus (Ctrl+K)">
      <span className="fab-icon">✦</span>
      {unread > 0 && <span className="fab-badge">{unread}</span>}
    </button>
  )
}

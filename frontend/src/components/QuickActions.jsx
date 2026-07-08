import React from 'react'
export default function QuickActions({ items, onAction }) {
  return (
    <div className="quick-actions" role="list">
      {items.map(a => (
        <button key={a.label} className="chip" role="listitem" onClick={() => onAction(a.text)}>
          {a.label}
        </button>
      ))}
    </div>
  )
}

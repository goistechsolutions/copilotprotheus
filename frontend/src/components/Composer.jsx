import React, { useEffect, useRef } from 'react'
export default function Composer({ value, onChange, onSend, loading }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
      if (e.key === 'Escape') el.blur()
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [onSend])
  return (
    <div className="composer">
      <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder="Pergunte algo... (Enter para enviar)" disabled={loading} />
      <button className="send-btn" onClick={onSend} disabled={loading || !value.trim()} aria-label="Enviar">↑</button>
    </div>
  )
}

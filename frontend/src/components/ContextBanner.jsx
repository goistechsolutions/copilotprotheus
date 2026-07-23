import React from 'react'
export default function ContextBanner({ state }) { const cls = state.ready ? 'ok' : 'loading'; return <div className={`context-banner ${cls}`}>{state.message}</div> }
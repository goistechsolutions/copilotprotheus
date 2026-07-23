import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import ContextBanner from '../components/ContextBanner'
import Composer from '../components/Composer'
import HistoryRail from '../components/HistoryRail'
import SuggestionCards from '../components/SuggestionCards'
import Conversation from '../components/Conversation'
import ResultPane from '../components/ResultPane'

const suggestions = [
  { title: 'Faturamento do mês', subtitle: 'por filial' },
  { title: 'Títulos vencendo na semana', subtitle: 'contas a pagar' },
  { title: 'Top 5 produtos', subtitle: 'mais vendidos' },
  { title: 'Clientes com risco', subtitle: 'inadimplência' },
]

export default function AgentWorkspace(){
  const context = useMemo(() => ({ tenant_id: 'tenant-id', company: '01', branch: '0101', user: 'admin', profile: 'Negócio', session_id: 'session-id' }), [])
  const [state, setState] = useState({ ready: false, message: 'Conectando ao Protheus...' })
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Aguardando contexto do Protheus.' }])
  const [history, setHistory] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await api.validateContext(context)
        if (!alive) return
        setState({ ready: !!res.ready, message: res.message || (res.ready ? 'Contexto pronto' : 'Contexto indisponível') })
        if (res.ready) {
          setMessages([{ role: 'assistant', text: 'Pronto. Posso ajudar com consultas, análises e relatórios.' }])
          setHistory(res.history || [{ title: 'Faturamento do mês', date: 'Hoje' }, { title: 'Títulos vencendo', date: 'Ontem' }])
        }
      } catch (e) {
        if (!alive) return
        setState({ ready: false, message: 'Falha ao validar contexto do Protheus' })
      }
    })()
    return () => { alive = false }
  }, [context])

  const send = async (text) => {
    if (!state.ready || !text?.trim()) return
    setMessages(m => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const payload = { ...context, request_id: `REQ-${Date.now()}`, prompt: text }
      const res = await api.askAgent(payload)
      setResult(res)
      setMessages(m => [...m, { role: 'assistant', text: res.answer || res.summary || 'Consulta concluída.' }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `Erro: ${String(e.message || e)}` }])
    }
    setLoading(false)
  }

  return <div className="shell">
    <HistoryRail items={history} onSelect={setSelected} onNew={() => { setMessages([{ role: 'assistant', text: 'Nova conversa iniciada.' }]); setResult(null); setSelected(null) }} />
    <main className="workspace">
      <ContextBanner state={state} />
      <header className="hero"><h1>Workspace Analítico</h1><p>Aqui aparecem os resultados gráficos e tabulares das suas requisições.</p></header>
      <SuggestionCards items={suggestions} disabled={!state.ready || loading} onPick={(it) => send(it.title)} />
      <Conversation messages={messages} />
      <Composer disabled={!state.ready || loading} onSend={send} placeholder={state.ready ? 'Faça sua pergunta sobre o Protheus...' : 'Aguardando contexto do Protheus...'} />
      {selected && <div className="selected">Histórico selecionado: {selected.title}</div>}
    </main>
    <aside className="results"><ResultPane result={result} /></aside>
  </div>
}
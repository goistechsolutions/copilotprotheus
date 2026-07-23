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

  return <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
    <HistoryRail items={history} onSelect={setSelected} onNew={() => { setMessages([{ role: 'assistant', text: 'Nova conversa iniciada.' }]); setResult(null); setSelected(null) }} />
    <main className="flex-1 flex flex-col bg-slate-800 shadow-xl z-10 overflow-hidden relative">
      <ContextBanner state={state} />
      <header className="px-8 py-6 text-center border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-sm z-10">
         <h1 className="text-2xl font-semibold text-slate-100">Workspace Analítico</h1>
         <p className="text-slate-400 mt-2 text-sm">Aqui aparecem os resultados gráficos e tabulares das suas requisições.</p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scroll-smooth">
          <SuggestionCards items={suggestions} disabled={!state.ready || loading} onPick={(it) => send(it.title)} />
          <Conversation messages={messages} />
          {selected && <div className="p-4 mx-auto w-full max-w-3xl bg-blue-500/10 text-blue-400 rounded-lg text-sm border border-blue-500/20">Histórico selecionado: {selected.title}</div>}
      </div>
      <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0">
          <Composer disabled={!state.ready || loading} onSend={send} placeholder={state.ready ? 'Faça sua pergunta sobre o Protheus...' : 'Aguardando contexto do Protheus...'} />
      </div>
    </main>
    <aside className="w-[450px] shrink-0 bg-slate-900 border-l border-slate-700 overflow-y-auto flex-col hidden lg:flex">
       <ResultPane result={result} />
    </aside>
  </div>
}
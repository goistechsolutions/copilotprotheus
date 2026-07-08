(function () {
  const WIDGET_ID  = 'cprot-widget-frame'

  function getContext(configuredTenant) {
    const p = new URLSearchParams(window.location.search)
    return new URLSearchParams({
      tenant_id:   configuredTenant || p.get('tenant_id')   || '',
      environment: p.get('environment') || 'validacao',
      company:     p.get('company')     || '01',
      branch:      p.get('branch')      || '0101',
      module:      detectModule(),
      user:        p.get('user')        || 'admin',
      station:     'WEB01',
      session_id:  'ext-' + Date.now(),
      pedido:      p.get('pedido')      || '',
      cliente:     p.get('cliente')     || '',
      produto:     p.get('produto')     || '',
    }).toString()
  }

  function detectModule() {
    // tenta detectar modulo pelo titulo da pagina ou URL
    const url   = window.location.href.toLowerCase()
    const title = document.title.toLowerCase()
    const map   = {
      'sigafat': 'SIGAFAT', 'faturamento': 'SIGAFAT',
      'sigacom': 'SIGACOM', 'compras':     'SIGACOM',
      'sigafin': 'SIGAFIN', 'financeiro':  'SIGAFIN',
      'sigaest': 'SIGAEST', 'estoque':     'SIGAEST',
    }
    for (const [key, val] of Object.entries(map)) {
      if (url.includes(key) || title.includes(key)) return val
    }
    return 'PROTHEUS'
  }

  function injectWidget() {
    // evita duplicar
    if (document.getElementById(WIDGET_ID)) return

    chrome.storage.local.get(['widget_url', 'tenant_id'], function (result) {
      const widgetBaseUrl = result.widget_url || 'https://copilot.elitecorp.tec.br/';
      const configuredTenant = result.tenant_id || '';
      
      const iframe = document.createElement('iframe')
      iframe.id    = WIDGET_ID
      iframe.src   = widgetBaseUrl + (widgetBaseUrl.endsWith('/') ? '' : '/') + '?' + getContext(configuredTenant)
      iframe.allow = 'clipboard-write'
      Object.assign(iframe.style, {
        position:     'fixed',
        bottom:       '0',
        right:        '0',
        width:        '100px',
        height:       '100px',
        border:       'none',
        zIndex:       '2147483647',
        background:   'transparent',
        colorScheme:  'normal',
        pointerEvents:'auto',
        transition:   'width 0.2s ease, height 0.2s ease',
      })

      // aguarda body estar disponivel
      const target = document.body || document.documentElement
      target.appendChild(iframe)
    });
  }

  function ensureWidget() {
    if (!document.getElementById(WIDGET_ID)) injectWidget()
  }

  // Injetar imediatamente se body existir
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWidget)
  } else {
    injectWidget()
  }

  // Reinjetar se o DOM remover o iframe (SPA / Protheus WebApp)
  const observer = new MutationObserver(() => ensureWidget())
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // Reinjetar em navegacoes SPA (pushState / replaceState)
  const _push    = history.pushState.bind(history)
  const _replace = history.replaceState.bind(history)
  history.pushState    = (...a) => { _push(...a);    setTimeout(ensureWidget, 300) }
  history.replaceState = (...a) => { _replace(...a); setTimeout(ensureWidget, 300) }
  window.addEventListener('popstate',  () => setTimeout(ensureWidget, 300))
  window.addEventListener('hashchange',() => setTimeout(ensureWidget, 300))

  // Toggle Ctrl+Shift+P
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      const f = document.getElementById(WIDGET_ID)
      if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none'
    }
  })

  // Resize listener
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'cprot-resize') {
      const f = document.getElementById(WIDGET_ID)
      if (!f) return

      if (e.data.maximized) {
        // Modo maximizado: cobre toda a viewport
        Object.assign(f.style, {
          width: '100vw',
          height: '100vh',
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
          borderRadius: '0',
        })
      } else if (e.data.open && !e.data.minimized) {
        // Modo normal aberto
        Object.assign(f.style, {
          width: '420px',
          height: '620px',
          top: 'auto',
          left: 'auto',
          right: '0',
          bottom: '0',
          borderRadius: '',
        })
      } else if (e.data.open && e.data.minimized) {
        Object.assign(f.style, {
          width: '420px',
          height: '120px',
          top: 'auto',
          left: 'auto',
          right: '0',
          bottom: '0',
          borderRadius: '',
        })
      } else {
        // Fechado: botão launcher
        Object.assign(f.style, {
          width: '100px',
          height: '100px',
          top: 'auto',
          left: 'auto',
          right: '0',
          bottom: '0',
          borderRadius: '',
        })
      }
    }
    
    // Leitura da tela (Screen Scraping)
    if (e.data && e.data.type === 'cprot-request-screen') {
      const f = document.getElementById(WIDGET_ID)
      if (!f || !f.contentWindow) return
      
      let text = document.body.innerText || ''
      // Limpa espacos duplos e quebras longas
      text = text.replace(/\s+/g, ' ').trim()
      // Limita a 4000 caracteres para poupar o LLM
      text = text.substring(0, 4000)
      
      f.contentWindow.postMessage({ type: 'cprot-screen-data', text }, '*')
    }
  })
})()

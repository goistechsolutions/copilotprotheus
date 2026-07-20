(function () {
  const WIDGET_ID  = 'cprot-widget-frame'
  let sessionData = {
    company: '',
    branch: '',
    user: '',
    environment: ''
  }
  let widgetInjected = false;

  function getContext(configuredTenant) {
    const p = new URLSearchParams(window.location.search)
    return new URLSearchParams({
      tenant_id:   configuredTenant || p.get('tenant_id')   || '',
      environment: sessionData.environment,
      company:     sessionData.company,
      branch:      sessionData.branch,
      module:      detectModule(),
      user:        sessionData.user,
      station:     'WEB01',
      session_id:  'ext-' + Date.now(),
      pedido:      p.get('pedido')      || '',
      cliente:     p.get('cliente')     || '',
      produto:     p.get('produto')     || '',
    }).toString()
  }

  function detectModule() {
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

  function extractProtheusSession() {
    // 1. Tentar ler do sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
       const key = sessionStorage.key(i);
       const val = sessionStorage.getItem(key);
       if (!val) continue;
       try {
         const json = JSON.parse(val);
         if (json.cEmpresa) sessionData.company = json.cEmpresa;
         if (json.cFilial) sessionData.branch = json.cFilial;
         if (json.cUsuario || json.user) sessionData.user = json.cUsuario || json.user;
         if (json.environment) sessionData.environment = json.environment;
       } catch(e) {}
    }
    
    // 2. Extração via Web Scraping Heurístico (DOM)
    const allSpans = Array.from(document.querySelectorAll('span, div, label'));
    
    for (const el of allSpans) {
      const text = el.textContent || '';
      
      // Procura formato "Empresa: 01" ou "Empresa 01"
      let match = text.match(/Empresa[\s:]+([0-9a-zA-Z]+)/i);
      if (match && match[1]) sessionData.company = match[1].substring(0, 2);
      
      // Procura formato "Filial: 0101"
      match = text.match(/Filial[\s:]+([0-9a-zA-Z]+)/i);
      if (match && match[1]) sessionData.branch = match[1].substring(0, 4);
      
      // Procura formato "Usuário: admin"
      match = text.match(/Usu[aá]rio[\s:]+([0-9a-zA-Z_]+)/i);
      if (match && match[1]) sessionData.user = match[1];
    }
  }

  function isUserLoggedIn() {
    if (!document.body) return false; // Se o body ainda não existe, não está logado/carregado

    // 1. Se tem campo de senha visível, não está logado
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
    const isLoginVisible = passwordInputs.some(el => el.offsetParent !== null);
    if (isLoginVisible) return false;

    // 2. Se tem a tela inicial de parâmetros (Programa Inicial, Ambiente no servidor) visível, ainda não entrou no workspace
    const bodyText = document.body.textContent || "";
    const hasInitialModal = bodyText.includes("Programa Inicial") && bodyText.includes("Ambiente no servidor");
    if (hasInitialModal) return false;

    // Se não tem senha e não tem modal inicial, assumimos que está logado no Workspace!
    return true;
  }

  function injectWidget() {
    if (widgetInjected || document.getElementById(WIDGET_ID)) return;

    extractProtheusSession();

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

      const target = document.body || document.documentElement
      target.appendChild(iframe)
      widgetInjected = true;
    });
  }
  
  function removeWidget() {
    const frame = document.getElementById(WIDGET_ID);
    if (frame) {
      frame.remove();
      widgetInjected = false;
    }
  }

  // Monitor principal: avalia login e logout
  function checkSessionState() {
    if (isUserLoggedIn()) {
      if (!widgetInjected) injectWidget();
    } else {
      if (widgetInjected) removeWidget();
    }
  }

  // Avaliação inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSessionState)
  } else {
    checkSessionState()
  }

  // Observa mudanças no DOM para reagir a SPA (login/logout)
  const observer = new MutationObserver(() => checkSessionState())
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false })

  // Toggle Ctrl+Shift+P
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      const f = document.getElementById(WIDGET_ID)
      if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none'
    }
  })

  // Resize listener & Scraping
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'cprot-resize') {
      const f = document.getElementById(WIDGET_ID)
      if (!f) return

      if (e.data.maximized) {
        Object.assign(f.style, { width: '100vw', height: '100vh', top: '0', right: '0', bottom: '0', left: '0', borderRadius: '0' })
      } else if (e.data.open && !e.data.minimized) {
        Object.assign(f.style, { width: '420px', height: '620px', top: 'auto', left: 'auto', right: '0', bottom: '0', borderRadius: '' })
      } else if (e.data.open && e.data.minimized) {
        Object.assign(f.style, { width: '420px', height: '120px', top: 'auto', left: 'auto', right: '0', bottom: '0', borderRadius: '' })
      } else {
        Object.assign(f.style, { width: '100px', height: '100px', top: 'auto', left: 'auto', right: '0', bottom: '0', borderRadius: '' })
      }
    }
    
    if (e.data && e.data.type === 'cprot-save-auth') {
      chrome.storage.local.set({
        agent_user: e.data.agent_user,
        agent_password: e.data.agent_password
      });
    }

    if (e.data && e.data.type === 'cprot-request-screen') {
      const f = document.getElementById(WIDGET_ID)
      if (!f || !f.contentWindow) return
      
      let text = document.body.innerText || ''
      text = text.replace(/\s+/g, ' ').trim()
      text = text.substring(0, 4000)
      
      try {
        chrome.runtime.sendMessage({ action: "capture_screen" }, function(response) {
           let imageBase64 = null;
           if (response && response.dataUrl) {
              imageBase64 = response.dataUrl;
           }
           f.contentWindow.postMessage({ type: 'cprot-screen-data', text: text, image: imageBase64 }, '*')
        });
      } catch (err) {
         f.contentWindow.postMessage({ type: 'cprot-screen-data', text: text, image: null }, '*')
      }
    }

    if (e.data && e.data.type === 'cprot-request-analysis') {
      const f = document.getElementById(WIDGET_ID)
      if (!f || !f.contentWindow) return

      const query = e.data.query;
      const image = e.data.image;
      
      chrome.storage.local.get(['tenant_id', 'agent_user', 'agent_password'], function (result) {
          const configuredTenant = result.tenant_id || new URLSearchParams(window.location.search).get('tenant_id') || '';
          
          const payload = {
            context: sessionData,
            question: query,
            tenant_id: configuredTenant,
            history: e.data.history || [],
            image: image,
            agent_user: result.agent_user,
            agent_password: result.agent_password
          };

          try {
            chrome.runtime.sendMessage({
              action: 'cprot_api_fetch',
              url: 'https://copilot-api.elitecorp.tec.br/api/ask',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }, function(response) {
              if (!response) {
                const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Desconhecido";
                console.error("Erro ao comunicar com background:", err);
                f.contentWindow.postMessage({ type: 'cprot-dashboard-error', error: `Erro de comunicação interna: ${err}` }, '*');
                return;
              }
              if (response.error) {
                console.error("Erro ao comunicar com backend Hetzner:", response.error);
                f.contentWindow.postMessage({ type: 'cprot-dashboard-error', error: `Falha na requisição (Background): ${response.error}` }, '*');
                return;
              }
              if (!response.ok) {
                console.error("HTTP Error:", response.status, response.text);
                let msg = "Não foi possível carregar a análise.";
                if (response.status === 504) {
                   msg = "Tempo limite excedido. A consulta demorou muito e foi cancelada para proteger o banco de dados. Tente adicionar filtros como datas ou quantidades menores.";
                } else {
                   msg = `Erro do servidor: ${response.status}`;
                }
                f.contentWindow.postMessage({ type: 'cprot-dashboard-error', error: msg }, '*');
                return;
              }
              
              try {
                const data = JSON.parse(response.text);
                // Manda os dados formatados do Gemini de volta para o React desenhar o gráfico
                f.contentWindow.postMessage({ type: 'cprot-dashboard-data', payloadGemini: data }, '*');
              } catch(e) {
                console.error("Erro ao parsear JSON:", e);
                f.contentWindow.postMessage({ type: 'cprot-dashboard-error', error: "Erro na resposta do servidor." }, '*');
              }
            });
          } catch(err) {
            console.error("Contexto de extensão inválido:", err);
            f.contentWindow.postMessage({ type: 'cprot-dashboard-error', error: "A extensão foi atualizada. Por favor, atualize a página do Protheus (Aperte F5)." }, '*');
          }
      });
    }
    
    // Ações vindas do Chat
    if (e.data && e.data.type === 'cprot-open-routine') {
      const routine = e.data.routine;
      // Provisoriamente aciona um toast/alerta nativo
      // No futuro, se houver função ADVPL/WebClient injetada, chamá-la aqui.
      alert(`Copilot Protheus:\nAbrindo a rotina solicitada: ${routine}`);
    }
    
    if (e.data && e.data.type === 'cprot-export-excel') {
      alert(`Copilot Protheus:\nIniciando exportação para Excel...`);
    }

  });
})()

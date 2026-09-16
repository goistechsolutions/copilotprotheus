(function () {
  if (document.getElementById("copilot-protheus-host")) return;

  let pollInterval = null;
  let observer = null;
  let currentConfig = null;
  let iframeLoaded = false;
  let cachedBodyText = { text: "", timestamp: 0 };
  let lastSentContextKey = "";

  function getBodyText() {
    const now = Date.now();
    if (now - cachedBodyText.timestamp < 300) {
      return cachedBodyText.text;
    }
    cachedBodyText.text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    cachedBodyText.timestamp = now;
    return cachedBodyText.text;
  }

  const PROTHEUS_MODULE_MAP = {
    "faturamento": "SIGAFAT",
    "compras": "SIGACOM",
    "financeiro": "SIGAFIN",
    "estoque": "SIGAEST",
    "estoque e custos": "SIGAEST",
    "contabilidade": "SIGACTB",
    "contabilidade gerencial": "SIGACTB",
    "livros fiscais": "SIGAFIS",
    "fiscal": "SIGAFIS",
    "gestao de pessoal": "SIGAGPE",
    "gestão de pessoal": "SIGAGPE",
    "recursos humanos": "SIGAGPE",
    "ativo fixo": "SIGAATF",
    "pms": "SIGAPMS",
    "pcp": "SIGAPCP",
    "manutencao": "SIGAMNT",
    "manutenção": "SIGAMNT",
    "qualidade": "SIGAQMT",
    "transportes": "SIGATMS",
    "tms": "SIGATMS",
    "comercio exterior": "SIGAEEC",
    "comércio exterior": "SIGAEEC",
    "call center": "SIGATMK",
    "crm": "SIGACRM",
    "faturamento e vendas": "SIGAFAT"
  };

  function extractProtheusContext() {
    const context = {
      tenant_id: currentConfig?.tenantId || "rodol_prod",
      company: "01",
      branch: "0101",
      user: currentConfig?.username || "admin",
      environment_code: currentConfig?.environmentCode || "c8te0u_prod",
      module: "SIGAFAT",
      session_id: "protheus-" + Date.now()
    };

    try {
      const bodyText = getBodyText();

      // 1. Extração do Módulo Ativo (ex: SIGAFAT, SIGAFIN, SIGACOM, ou nome textual)
      const sigaMatch = bodyText.match(/\bSIGA[A-Z]{3,}\b/i);
      if (sigaMatch) {
        context.module = sigaMatch[0].toUpperCase();
      } else {
        for (const key of Object.keys(PROTHEUS_MODULE_MAP)) {
          const regex = new RegExp(`\\b${key}\\b`, "i");
          if (regex.test(bodyText)) {
            context.module = PROTHEUS_MODULE_MAP[key];
            break;
          }
        }
      }

      // 2. Extração do Ambiente TOTVS Cloud
      const envMatch = bodyText.match(/c8te0u[_\w]+/i) || bodyText.match(/TOTVS[^\n]{0,60}/i);
      if (envMatch) {
        context.environment_code = envMatch[0].trim();
      }

      // 3. Extração de Empresa / Filial
      const companyBranchPatterns = [
        /\b(\d{2})\s*[\/-]\s*(\d{2,4})\b/,
        /Empresa[:\s]+([^\n]{2,40})/i,
        /Filial[:\s]+([^\n]{2,40})/i
      ];

      for (const pattern of companyBranchPatterns) {
        const match = bodyText.match(pattern);
        if (!match) continue;
        if (match[2]) {
          context.company = (match[1] || "").trim();
          context.branch = (match[2] || "").trim();
          break;
        }
      }

      // 4. Usuário
      const userMatch = bodyText.match(/Usuário[:\s]+([^\n]{2,40})/i) || bodyText.match(/User[:\s]+([^\n]{2,40})/i);
      if (userMatch && userMatch[1]) {
        context.user = userMatch[1].trim();
      }
    } catch (err) {
      console.warn("Copilot Protheus: erro na extração de contexto:", err);
    }

    return context;
  }

  // Criar Shadow DOM para isolamento visual total
  const host = document.createElement("div");
  host.id = "copilot-protheus-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Injeção de estilos diretos garantidos
  const style = document.createElement("style");
  style.textContent = `
    #copilot-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: #004fce;
      box-shadow: 0 8px 24px rgba(0, 79, 206, 0.35);
      cursor: pointer;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 20px;
      transition: all 0.2s ease;
      user-select: none;
    }
    #copilot-fab:hover {
      transform: translateY(-2px) scale(1.04);
      background: #003ea6;
    }
    #copilot-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: min(580px, calc(100vw - 32px));
      height: min(800px, calc(100vh - 48px));
      min-width: 420px;
      min-height: 500px;
      max-width: min(1200px, calc(100vw - 24px));
      max-height: calc(100vh - 24px);
      background: #ffffff !important;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.2);
      z-index: 999999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #copilot-panel.is-resizing {
      transition: none !important;
      user-select: none !important;
    }
    #copilot-panel.is-resizing #copilot-iframe {
      pointer-events: none !important;
    }
    #copilot-panel.results-open {
      width: min(1560px, calc(100vw - 48px)) !important;
      height: min(920px, calc(100vh - 48px)) !important;
      max-width: 1560px !important;
      max-height: 920px !important;
    }
    .copilot-resizer-l {
      position: absolute;
      top: 0;
      left: 0;
      width: 8px;
      height: 100%;
      cursor: ew-resize;
      z-index: 100;
      transition: background 0.15s;
    }
    .copilot-resizer-l:hover {
      background: rgba(59, 130, 246, 0.3);
    }
    .copilot-resizer-t {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 8px;
      cursor: ns-resize;
      z-index: 100;
      transition: background 0.15s;
    }
    .copilot-resizer-t:hover {
      background: rgba(59, 130, 246, 0.3);
    }
    .copilot-resizer-tl {
      position: absolute;
      top: 0;
      left: 0;
      width: 22px;
      height: 22px;
      cursor: nwse-resize;
      z-index: 101;
      display: flex;
      align-items: center;
      justify-content: center;
      border-top-left-radius: 20px;
      transition: background 0.15s;
    }
    .copilot-resizer-tl::after {
      content: '';
      width: 8px;
      height: 8px;
      border-top: 2px solid #94a3b8;
      border-left: 2px solid #94a3b8;
      border-top-left-radius: 4px;
      opacity: 0.7;
    }
    .copilot-resizer-tl:hover {
      background: rgba(59, 130, 246, 0.2);
    }
    .copilot-resizer-tl:hover::after {
      border-color: #2563eb;
      opacity: 1;
    }
    #copilot-panel-header {
      background: #ffffff !important;
      color: #171c20 !important;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    #copilot-header-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #copilot-header-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
    }
    #copilot-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #copilot-reset-size,
    #copilot-close {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 15px;
      padding: 4px 8px;
      border-radius: 8px;
      transition: all 0.15s;
    }
    #copilot-reset-size:hover,
    #copilot-close:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    #copilot-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      position: relative;
      background: #ffffff !important;
    }
    #copilot-iframe {
      border: none;
      width: 100%;
      height: 100%;
      display: block;
      background: #ffffff !important;
    }
  `;
  shadow.appendChild(style);

  const cssUrl = chrome.runtime.getURL("widget.css");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = cssUrl;
  shadow.appendChild(link);

  const fab = document.createElement("div");
  fab.id = "copilot-fab";
  fab.title = "Copilot Protheus (Ctrl+Shift+P)";
  fab.innerHTML = `<span>✦</span>`;
  shadow.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "copilot-panel";
  panel.innerHTML = `
    <div class="copilot-resizer-l" title="Arraste para ajustar largura"></div>
    <div class="copilot-resizer-t" title="Arraste para ajustar altura"></div>
    <div class="copilot-resizer-tl" title="Arraste para redimensionar o chat livremente"></div>
    <div id="copilot-panel-header">
      <div id="copilot-header-brand">
        <span id="copilot-header-dot"></span>
        <span>Copilot Protheus</span>
      </div>
      <div id="copilot-header-actions">
        <button id="copilot-reset-size" type="button" aria-label="Restaurar tamanho padrão" title="Restaurar tamanho padrão (580x800)">⟲</button>
        <button id="copilot-close" type="button" aria-label="Fechar" title="Fechar Copilot">✕</button>
      </div>
    </div>
    <div id="copilot-body">
      <iframe id="copilot-iframe" src="" title="Copilot Protheus"></iframe>
    </div>
  `;
  shadow.appendChild(panel);

  // ─── Lógica de Redimensionamento Livre com o Mouse ────────────────────────
  const resizerL = panel.querySelector('.copilot-resizer-l');
  const resizerT = panel.querySelector('.copilot-resizer-t');
  const resizerTL = panel.querySelector('.copilot-resizer-tl');
  const btnReset = panel.querySelector('#copilot-reset-size');

  let isResizing = false;
  let currentResizeMode = null;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  function initResize(e, mode) {
    if (panel.classList.contains('results-open')) return;
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    currentResizeMode = mode;
    startX = e.clientX;
    startY = e.clientY;
    startW = panel.offsetWidth;
    startH = panel.offsetHeight;

    panel.classList.add('is-resizing');

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isResizing) return;

    if (currentResizeMode === 'l' || currentResizeMode === 'tl') {
      const deltaX = startX - e.clientX;
      const newWidth = Math.min(
        Math.max(startW + deltaX, 420),
        window.innerWidth - 32
      );
      panel.style.width = `${newWidth}px`;
    }

    if (currentResizeMode === 't' || currentResizeMode === 'tl') {
      const deltaY = startY - e.clientY;
      const newHeight = Math.min(
        Math.max(startH + deltaY, 500),
        window.innerHeight - 32
      );
      panel.style.height = `${newHeight}px`;
    }
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    panel.classList.remove('is-resizing');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    const customSize = {
      width: parseInt(panel.style.width, 10),
      height: parseInt(panel.style.height, 10)
    };
    if (customSize.width && customSize.height) {
      try {
        localStorage.setItem('copilot_chat_size', JSON.stringify(customSize));
      } catch (err) {}
    }
  }

  resizerL?.addEventListener('mousedown', (e) => initResize(e, 'l'));
  resizerT?.addEventListener('mousedown', (e) => initResize(e, 't'));
  resizerTL?.addEventListener('mousedown', (e) => initResize(e, 'tl'));

  // Botão de restaurar tamanho padrão
  btnReset?.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      localStorage.removeItem('copilot_chat_size');
    } catch (err) {}
    panel.style.width = `min(580px, calc(100vw - 32px))`;
    panel.style.height = `min(800px, calc(100vh - 48px))`;
  });

  // Aplica tamanho customizado se previamente salvo pelo usuário
  try {
    const saved = localStorage.getItem('copilot_chat_size');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.width >= 420 && parsed.height >= 500) {
        panel.style.width = `${Math.min(parsed.width, window.innerWidth - 32)}px`;
        panel.style.height = `${Math.min(parsed.height, window.innerHeight - 32)}px`;
      }
    }
  } catch (err) {}

  // Escuta redimensionamento solicitado pelo Copilot (Dashboard)
  window.addEventListener("message", (event) => {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (event.data?.type === "cprot-result-state") {
      const isOpen = Boolean(event.data.open);
      panel.classList.toggle("results-open", isOpen);
      if (!isOpen) {
        // Ao fechar o dashboard, restaura tamanho salvo ou padrão
        try {
          const saved = localStorage.getItem('copilot_chat_size');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.width && parsed.height) {
              panel.style.width = `${Math.min(parsed.width, window.innerWidth - 32)}px`;
              panel.style.height = `${Math.min(parsed.height, window.innerHeight - 32)}px`;
              return;
            }
          }
        } catch (err) {}
        panel.style.width = `min(580px, calc(100vw - 32px))`;
        panel.style.height = `min(800px, calc(100vh - 48px))`;
      }
    }
  });

  function buildIframeUrl(config, context) {
    const baseUrl = config.widgetUrl || "https://copilot.elitecorp.tec.br/";
    const url = new URL(baseUrl);
    url.searchParams.set("tenant_id", config.tenantId || context.tenant_id || "rodol_prod");
    url.searchParams.set("environment_code", config.environmentCode || context.environment_code || "c8te0u_prod");
    url.searchParams.set("company", context.company || "01");
    url.searchParams.set("branch", context.branch || "0101");
    url.searchParams.set("user", context.user || config.username || "admin");
    url.searchParams.set("module", context.module || "SIGAFAT");
    url.searchParams.set("session_id", context.session_id || "");
    return url.toString();
  }

  function sendContextToIframe(context) {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe?.contentWindow) return;

    const payload = {
      tenant_id: currentConfig?.tenantId || context.tenant_id || "rodol_prod",
      environment_code: currentConfig?.environmentCode || context.environment_code || "c8te0u_prod",
      company: context.company || "01",
      branch: context.branch || "0101",
      user: context.user || currentConfig?.username || "admin",
      module: context.module || "SIGAFAT",
      session_id: context.session_id || ""
    };

    const key = JSON.stringify(payload);
    if (key === lastSentContextKey) return;
    lastSentContextKey = key;

    iframe.contentWindow.postMessage(
      { type: "PROTHEUS_CONTEXT", payload },
      "*"
    );
  }

  function loadIframe(config) {
    const iframe = shadow.querySelector("#copilot-iframe");
    const context = extractProtheusContext();

    if (!iframeLoaded) {
      iframe.src = buildIframeUrl(config, context);
      iframe.onload = () => {
        iframeLoaded = true;
        sendContextToIframe(context);
      };
    } else {
      sendContextToIframe(context);
    }
  }

  function init(config) {
    currentConfig = config;
    loadIframe(config);

    // Monitora atualizações no contexto do Protheus
    function syncContext() {
      const ctx = extractProtheusContext();
      sendContextToIframe(ctx);
    }

    pollInterval = setInterval(syncContext, 2500);

    observer = new MutationObserver(() => {
      syncContext();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function togglePanel() {
    const isVisible = panel.style.display === "flex";
    panel.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
      const ctx = extractProtheusContext();
      sendContextToIframe(ctx);
    }
  }

  fab.addEventListener("click", togglePanel);
  shadow.querySelector("#copilot-close").addEventListener("click", togglePanel);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "toggle-widget") {
      togglePanel();
    }
  });

  chrome.storage.sync.get(
    ["tenantId", "environmentCode", "username", "widgetUrl"],
    (result) => {
      const config = {
        tenantId: result.tenantId || "rodol_prod",
        environmentCode: result.environmentCode || "c8te0u_prod",
        username: result.username || "admin",
        widgetUrl: result.widgetUrl || "https://copilot.elitecorp.tec.br/"
      };
      init(config);
    }
  );
})();
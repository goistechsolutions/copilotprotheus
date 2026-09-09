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

    const parts = [document.body?.innerText || ""];
    // innerText não contém necessariamente o valor atual de inputs/selects do WebApp.
    // Lemos somente controles visíveis e nunca campos de senha ou token.
    document.querySelectorAll("input, select, textarea, [aria-label], [data-testid], [title]").forEach((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const type = String(element.getAttribute("type") || "").toLowerCase();
      if (type === "password" || type === "hidden") return;
      const value = element.value || element.getAttribute("aria-label") || element.getAttribute("data-testid") || element.getAttribute("title") || "";
      if (value) parts.push(String(value));
    });

    cachedBodyText.text = parts.join(" ").replace(/\s+/g, " ").trim();
    cachedBodyText.timestamp = now;
    return cachedBodyText.text;
  }

  const DEFAULT_WIDGET_URL = "https://copilot.elitecorp.tec.br/";

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
      tenant_id: currentConfig?.tenantId || null,
      company: null,
      branch: null,
      user: currentConfig?.username || null,
      environment_code: currentConfig?.environmentCode || null,
      module: null,
      session_id: null
    };

    try {
      const bodyText = getBodyText();
      const normalizedText = bodyText.replace(/\u00a0/g, " ");

      // Programa inicial SIGAMDI é o menu do WebApp, não um módulo de negócio.
      const sigaMatches = normalizedText.match(/\bSIGA[A-Z]{3,}\b/gi) || [];
      const operationalModule = sigaMatches.find((value) => value.toUpperCase() !== "SIGAMDI");
      if (operationalModule) {
        context.module = operationalModule.toUpperCase();
      } else {
        for (const key of Object.keys(PROTHEUS_MODULE_MAP)) {
          if (new RegExp(`\\b${key}\\b`, "i").test(normalizedText)) {
            context.module = PROTHEUS_MODULE_MAP[key];
            break;
          }
        }
      }

      // O ambiente é obtido do valor junto ao rótulo, sem depender de um código fixo.
      const envMatch = normalizedText.match(/(?:Ambiente(?:\s+no\s+servidor)?|Environment(?:\s+Code)?)\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9_-]{1,80})/i);
      if (envMatch?.[1] && !/^no$/i.test(envMatch[1])) {
        context.environment_code = envMatch[1].trim();
      }

      // Aceita tanto "01/0101" quanto campos separados de Empresa e Filial.
      const pairMatch = normalizedText.match(/\b(\d{1,4})\s*[\/-]\s*(\d{2,10})\b/);
      const companyMatch = normalizedText.match(/(?:Empresa|Company)\s*[:=]?\s*([A-Za-z0-9]{1,20})/i);
      const branchMatch = normalizedText.match(/(?:Filial|Branch)\s*[:=]?\s*([A-Za-z0-9]{2,20})/i);
      if (pairMatch) {
        context.company = pairMatch[1].trim();
        context.branch = pairMatch[2].trim();
      } else {
        context.company = companyMatch?.[1]?.trim() || null;
        context.branch = branchMatch?.[1]?.trim() || null;
      }

      const userMatch = normalizedText.match(/(?:Usuário|Usuario|User)\s*[:=]?\s*([^,;|]{2,80})/i);
      if (userMatch?.[1]) {
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
      width: min(460px, calc(100vw - 32px));
      height: min(760px, calc(100vh - 48px));
      max-width: 460px;
      max-height: 760px;
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
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #copilot-panel.results-open {
      width: min(1560px, calc(100vw - 48px));
      height: min(920px, calc(100vh - 48px));
      max-width: 1560px;
      max-height: 920px;
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
    #copilot-close {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 8px;
    }
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
    <div id="copilot-panel-header">
      <div id="copilot-header-brand">
        <span id="copilot-header-dot"></span>
        <span>Copilot Protheus</span>
      </div>
      <button id="copilot-close" type="button" aria-label="Fechar">✕</button>
    </div>
    <div id="copilot-body">
      <iframe id="copilot-iframe" src="" title="Copilot Protheus"></iframe>
    </div>
  `;
  shadow.appendChild(panel);

  function getWidgetOrigin(config) {
    try {
      return new URL(config.widgetUrl || DEFAULT_WIDGET_URL).origin;
    } catch {
      return new URL(DEFAULT_WIDGET_URL).origin;
    }
  }

  // Escuta redimensionamento solicitado pelo Copilot somente da origem configurada.
  window.addEventListener("message", (event) => {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe || event.source !== iframe.contentWindow) return;
    if (event.origin !== getWidgetOrigin(currentConfig || {})) return;

    if (event.data?.type === "cprot-result-state") {
      panel.classList.toggle("results-open", Boolean(event.data.open));
    }
  });

  function buildIframeUrl(config) {
    // Contexto operacional é enviado por postMessage após o carregamento;
    // não deve ser exposto na URL, histórico ou referer do navegador.
    return config.widgetUrl || DEFAULT_WIDGET_URL;
  }

  function sendContextToIframe(context) {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe?.contentWindow) return;

    const payload = {
      tenant_id: currentConfig?.tenantId || context.tenant_id || null,
      environment_code: currentConfig?.environmentCode || context.environment_code || null,
      company: context.company || null,
      company_code: context.company || null,
      branch: context.branch || null,
      filial: context.branch || null,
      user: context.user || currentConfig?.username || null,
      module: context.module || null,
      session_id: context.session_id || null
    };

    const key = JSON.stringify(payload);
    if (key === lastSentContextKey) return;
    lastSentContextKey = key;

    iframe.contentWindow.postMessage(
      { type: "PROTHEUS_CONTEXT", payload },
      getWidgetOrigin(currentConfig || {})
    );
  }

  function loadIframe(config) {
    const iframe = shadow.querySelector("#copilot-iframe");
    const context = extractProtheusContext();

    if (!iframeLoaded) {
      iframe.src = buildIframeUrl(config);
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

  chrome.storage.local.get(
    ["tenantId", "environmentCode", "username", "widgetUrl"],
    (result) => {
      const config = {
        tenantId: result.tenantId || "",
        environmentCode: result.environmentCode || "",
        username: result.username || "",
        widgetUrl: result.widgetUrl || DEFAULT_WIDGET_URL
      };
      init(config);
    }
  );
})();
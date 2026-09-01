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

  // Escuta redimensionamento solicitado pelo Copilot
  window.addEventListener("message", (event) => {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (event.data?.type === "cprot-result-state") {
      panel.classList.toggle("results-open", Boolean(event.data.open));
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
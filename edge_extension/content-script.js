(function () {
  if (document.getElementById("copilot-protheus-host")) return;

  let isSessionReady = false;
  let pollInterval = null;
  let observer = null;
  let currentConfig = null;
  let iframeLoaded = false;
  let cachedBodyText = { text: "", timestamp: 0 };

  // 1. Leitura com cache do DOM
  function getBodyText() {
    const now = Date.now();
    if (now - cachedBodyText.timestamp < 200) {
      return cachedBodyText.text;
    }
    cachedBodyText.text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    cachedBodyText.timestamp = now;
    return cachedBodyText.text;
  }

  function hasLoginDialog(text) {
    return /Programa Inicial/i.test(text) && /Ambiente no servidor/i.test(text);
  }

  function detectActiveSession() {
    const text = getBodyText();
    if (!text) return false;

    // Sinais definitivos de usuário logado
    const strongSignals = [
      /SIGA[A-Z]{3,}/i.test(text),
      /Trocar m.dulo/i.test(text),
      /Faturamento/i.test(text),
      /Financeiro/i.test(text),
      /Compras/i.test(text),
      /Estoque/i.test(text),
      /TOTVS News/i.test(text),
      /Favoritos/i.test(text) && /Consultas/i.test(text)
    ];

    if (strongSignals.some(Boolean)) {
      return true;
    }

    if (hasLoginDialog(text)) return false;

    const signals = [
      /TOTVS/i.test(text),
      /Workspace/i.test(text),
      /Painel/i.test(text),
      /Menu/i.test(text),
      /Favoritos/i.test(text),
      /Administrador/i.test(text),
      /Usuário/i.test(text),
      /\/\s*[0-9]{2,}/.test(text)
    ];

    return signals.filter(Boolean).length >= 2;
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
      company: "01",
      branch: "0101",
      user: currentConfig?.username || "admin",
      environment: currentConfig?.environmentCode || "",
      module: "SIGAFAT",
      session_id: ""
    };

    try {
      const bodyText = getBodyText();

      const envMatch = bodyText.match(/TOTVS[^\n]{0,80}/i);
      if (envMatch) context.environment = envMatch[0].trim();

      const companyBranchPatterns = [
        /([\wÀ-ú\s.&-]+)\s*\/\s*([\wÀ-ú\s.-]{2,40})/,
        /Empresa[:\s]+([^\n]{2,60})/i,
        /Filial[:\s]+([^\n]{2,60})/i,
        /\b(\d{2})\s*[\/-]\s*(\d{2,4})\b/
      ];

      for (const pattern of companyBranchPatterns) {
        const match = bodyText.match(pattern);
        if (!match) continue;

        if (match[2]) {
          context.company = (match[1] || "").trim();
          context.branch = (match[2] || "").trim();
          break;
        }

        if (/Empresa/i.test(String(pattern))) {
          context.company = (match[1] || "").trim();
        }

        if (/Filial/i.test(String(pattern))) {
          context.branch = (match[1] || "").trim();
        }
      }

      // Usuário
      const userPatterns = [
        /Administrador/i,
        /Usuário[:\s]+([^\n]{2,40})/i,
        /User[:\s]+([^\n]{2,40})/i
      ];

      for (const pattern of userPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          context.user = (match[1] || match[0] || "").trim();
          break;
        }
      }
      if (!context.user && currentConfig?.username) {
        context.user = currentConfig.username;
      }

      // Módulo: 1. Busca código SIGA direto no DOM
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

      context.session_id = "protheus-" + Date.now();
    } catch (err) {
      console.warn("Copilot Protheus: falha ao extrair contexto do DOM.", err);
    }

    return context;
  }

  // 2. Isolamento via Shadow DOM
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
      <div id="copilot-waiting">
        <span>Aguardando efetuar login no Protheus...</span>
      </div>
      <iframe id="copilot-iframe" src="" title="Copilot Protheus" style="display:none;"></iframe>
    </div>
  `;
  shadow.appendChild(panel);

  // Escuta mensagens do iframe (ex: redimensionamento quando há resultado)
  window.addEventListener("message", (event) => {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (event.data?.type === "cprot-result-state") {
      panel.classList.toggle("results-open", Boolean(event.data.open));
    }
  });

  function updateWaitingMessage(message) {
    const waiting = shadow.querySelector("#copilot-waiting");
    if (waiting) waiting.innerHTML = `<span>${message}</span>`;
  }

  function buildIframeUrl(config, context) {
    const baseUrl = config.widgetUrl || "https://copilot.elitecorp.tec.br/";
    const url = new URL(baseUrl);
    url.searchParams.set("tenant_id", config.tenantId || "rodol_prod");
    if (config.environmentCode) url.searchParams.set("environment_code", config.environmentCode);
    if (context.company) url.searchParams.set("company", context.company);
    if (context.branch) url.searchParams.set("branch", context.branch);
    const user = context.user || config.username || "";
    if (user) url.searchParams.set("user", user);
    if (context.environment) url.searchParams.set("environment", context.environment);
    if (context.module) url.searchParams.set("module", context.module);
    if (context.session_id) url.searchParams.set("session_id", context.session_id);
    return url.toString();
  }

  function sendContextToIframe(context) {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe?.contentWindow || !currentConfig?.widgetUrl) return;

    const payload = {
      tenant_id: currentConfig.tenantId || "rodol_prod",
      environment_code: currentConfig.environmentCode || "",
      company: context.company || "01",
      branch: context.branch || "0101",
      user: context.user || currentConfig.username || "admin",
      module: context.module || "SIGAFAT",
      session_id: context.session_id || ""
    };

    iframe.contentWindow.postMessage(
      { type: "PROTHEUS_CONTEXT", payload },
      "*"
    );
  }

  function loadIframe(config) {
    const iframe = shadow.querySelector("#copilot-iframe");
    const waiting = shadow.querySelector("#copilot-waiting");
    const context = extractProtheusContext();

    if (!iframeLoaded) {
      iframe.src = buildIframeUrl(config, context);
      iframe.onload = () => {
        iframeLoaded = true;
        if (waiting) waiting.style.display = "none";
        iframe.style.display = "block";
        sendContextToIframe(context);
      };
    } else {
      sendContextToIframe(context);
    }
  }

  function initSessionChecker(config) {
    currentConfig = config;

    function check() {
      const active = detectActiveSession();

      if (active && !isSessionReady) {
        isSessionReady = true;
        loadIframe(config);
      } else if (!active && isSessionReady) {
        isSessionReady = false;
        iframeLoaded = false;
        const iframe = shadow.querySelector("#copilot-iframe");
        const waiting = shadow.querySelector("#copilot-waiting");
        if (iframe) {
          iframe.style.display = "none";
          iframe.src = "";
        }
        if (waiting) {
          waiting.style.display = "flex";
          updateWaitingMessage("Aguardando efetuar login no Protheus...");
        }
      } else if (active && isSessionReady) {
        const ctx = extractProtheusContext();
        sendContextToIframe(ctx);
      }
    }

    check();
    pollInterval = setInterval(check, 3000);

    observer = new MutationObserver(() => {
      check();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Alternar painel
  function togglePanel() {
    const isVisible = panel.style.display === "flex";
    panel.style.display = isVisible ? "none" : "flex";
    if (!isVisible && isSessionReady && currentConfig) {
      const ctx = extractProtheusContext();
      sendContextToIframe(ctx);
    }
  }

  fab.addEventListener("click", togglePanel);
  shadow.querySelector("#copilot-close").addEventListener("click", togglePanel);

  // Escuta comandos e atalhos da extensão
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "toggle-widget") {
      togglePanel();
    }
  });

  // Carrega configurações salvas do storage
  chrome.storage.sync.get(
    ["tenantId", "environmentCode", "username", "widgetUrl"],
    (result) => {
      const config = {
        tenantId: result.tenantId || "rodol_prod",
        environmentCode: result.environmentCode || "c8te0u_prod",
        username: result.username || "admin",
        widgetUrl: result.widgetUrl || "https://copilot.elitecorp.tec.br/"
      };
      initSessionChecker(config);
    }
  );
})();
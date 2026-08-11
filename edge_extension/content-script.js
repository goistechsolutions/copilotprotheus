(function () {
  if (document.getElementById("copilot-fab")) return;

  let isSessionReady = false;
  let pollInterval = null;

  function detectActiveSession() {
    const bodyText = document.body.innerText || "";
    const hasCompanyBranch = /Ltda[^\n]{0,10}\/[^\n]{0,40}/.test(bodyText);
    const hasLoginDialog = /Programa Inicial/i.test(bodyText) && /Ambiente no servidor/i.test(bodyText);
    return hasCompanyBranch && !hasLoginDialog;
  }

  function extractProtheusContext() {
    const context = { company: "", branch: "", user: "", environment: "", module: "" };
    try {
      const bodyText = document.body.innerText || "";

      const envMatch = bodyText.match(/TOTVS[^\n]{0,60}/);
      if (envMatch) context.environment = envMatch[0].trim();

      const companyMatch = bodyText.match(/[\wÀ-ú\s]+Ltda[^\n]{0,40}\/[^\n]{0,60}/);
      if (companyMatch) {
        const parts = companyMatch[0].split("/");
        context.company = parts[0]?.trim() || "";
        context.branch = parts[1]?.trim() || "";
      }

      const userMatch = bodyText.match(/Administrador|Usuário[^\n]{0,30}/);
      if (userMatch) context.user = userMatch[0].trim();

      const titleEl = document.querySelector("h1, h2, .title, [class*='titulo']");
      if (titleEl && titleEl.textContent) {
        context.module = titleEl.textContent.trim().slice(0, 30);
      }
    } catch (err) {
      console.warn("Copilot Protheus: falha ao extrair contexto do DOM.", err);
    }
    return context;
  }

  const fab = document.createElement("div");
  fab.id = "copilot-fab";
  fab.innerHTML = `<span>✦</span>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "copilot-panel";
  panel.innerHTML = `
    <div id="copilot-panel-header">
      <span>Copilot Protheus</span>
      <button id="copilot-close" type="button" aria-label="Fechar">✕</button>
    </div>
    <div id="copilot-body">
      <div id="copilot-waiting">Aguardando login no Protheus...</div>
      <iframe id="copilot-iframe" src="" title="Copilot Protheus" style="display:none;"></iframe>
    </div>
  `;
  document.body.appendChild(panel);

  let currentConfig = null;

  function buildIframeUrl(config, context) {
    const url = new URL(config.widgetUrl);
    url.searchParams.set("tenant", config.tenantId || "");
    if (context.company) url.searchParams.set("company", context.company);
    if (context.branch) url.searchParams.set("branch", context.branch);
    if (context.user) url.searchParams.set("user", context.user);
    if (context.environment) url.searchParams.set("environment", context.environment);
    if (context.module) url.searchParams.set("module", context.module);
    return url.toString();
  }

  function activateWidget(config) {
    const iframe = document.getElementById("copilot-iframe");
    const waiting = document.getElementById("copilot-waiting");
    const context = extractProtheusContext();

    iframe.src = buildIframeUrl(config, context);
    iframe.style.display = "block";
    waiting.style.display = "none";

    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow.postMessage(
          { type: "PROTHEUS_CONTEXT", context, tenantId: config.tenantId },
          "*"
        );
      } catch (err) {
        console.warn("Copilot Protheus: falha ao enviar contexto via postMessage.", err);
      }
    }, { once: true });

    isSessionReady = true;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function startSessionPolling(config) {
    if (pollInterval) return;
    pollInterval = setInterval(() => {
      if (detectActiveSession()) {
        activateWidget(config);
      }
    }, 1500);
  }

  function applyConfig(config) {
    currentConfig = config;
    if (!config?.widgetUrl) return;

    if (detectActiveSession()) {
      activateWidget(config);
    } else {
      startSessionPolling(config);
    }
  }

  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    if (chrome.runtime.lastError) {
      console.warn("Copilot Protheus: falha ao obter configuração.", chrome.runtime.lastError.message);
      return;
    }
    applyConfig(config);
  });

  fab.addEventListener("click", () => {
    panel.style.display = "flex";
    fab.style.display = "none";
    if (!isSessionReady && currentConfig) {
      startSessionPolling(currentConfig);
    }
  });

  panel.querySelector("#copilot-close").addEventListener("click", () => {
    panel.style.display = "none";
    fab.style.display = "flex";
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_WIDGET") {
      const isOpen = panel.style.display === "flex";
      panel.style.display = isOpen ? "none" : "flex";
      fab.style.display = isOpen ? "flex" : "none";
    }

    if (message.type === "RELOAD_WIDGET") {
      applyConfig(message.config);
    }
  });
})();
(function () {
  if (document.getElementById("copilot-protheus-host")) return;

  let isSessionReady = false;
  let pollInterval = null;
  let observer = null;
  let observerTimeout = null;
  let currentConfig = null;
  let iframeLoaded = false;
  let cachedBodyText = { text: "", timestamp: 0 };

  // 1. Otimizar a leitura do DOM
  function getBodyText() {
    const now = Date.now();
    // Cache de 200ms para evitar reflows multiplos na mesma avaliacao
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

    // Sinais definitivos de que o usuário JÁ está logado (ignora se a tela de login ainda estiver no DOM invisível)
    const strongSignals = [
      /SIGA[A-Z]{3,}/i.test(text), // Ex: SIGAFAT, SIGACOM
      /Trocar m.dulo/i.test(text),
      /Faturamento/i.test(text),
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
    "televendas": "SIGATMK",
    "crm": "SIGACRM",
    "loja": "SIGALOJA",
    "front loja": "SIGAFRT",
    "automação de ponto": "SIGAPON",
    "automacao de ponto": "SIGAPON",
    "ponto eletronico": "SIGAPON",
    "ponto eletrônico": "SIGAPON",
    "medicina e seguranca": "SIGAMDT",
    "medicina e segurança": "SIGAMDT",
    "recrutamento e selecao": "SIGARSP",
    "recrutamento e seleção": "SIGARSP",
    "avaliacao de desempenho": "SIGAADV",
    "avaliação de desempenho": "SIGAADV",
    "cargos e salarios": "SIGACSA",
    "cargos e salários": "SIGACSA",
    "gestao de servicos": "SIGATEC",
    "gestão de serviços": "SIGATEC",
    "serviços": "SIGATEC",
    "servicos": "SIGATEC",
    "inspecao de processos": "SIGAQIP",
    "inspeção de processos": "SIGAQIP",
    "auditoria": "SIGAQAD",
    "documentos": "SIGAQDO",
    "nao conformidades": "SIGAQNC",
    "não conformidades": "SIGAQNC",
    "controle de frete": "SIGAGFE",
    "gfe": "SIGAGFE",
    "contratos": "SIGAGCT",
    "gestao de contratos": "SIGAGCT",
    "gestão de contratos": "SIGAGCT",
    "orcamentos": "SIGAORC",
    "orçamentos": "SIGAORC",
    "wms": "SIGAWMS",
    "planejamento e controle de producao": "SIGAPCP",
    "planejamento e controle de produção": "SIGAPCP",
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
        // 2. Busca por elementos próximos a "Trocar módulo" no menu PO-UI
        const allElements = document.querySelectorAll("h1, h2, h3, span, div, p, a");
        let foundName = "";
        for (const el of allElements) {
          if (/Trocar m.dulo/i.test(el.textContent) && el.children.length === 0) {
            const parent = el.closest(".po-menu-header, .sidebar-header, nav, aside") || el.parentElement;
            if (parent) {
              const textLines = (parent.innerText || "").split("\n").map(l => l.trim()).filter(Boolean);
              const nameLine = textLines.find(l => !/Trocar m.dulo|TOTVS|Favoritos|Pesquisar/i.test(l) && l.length > 2);
              if (nameLine) {
                foundName = nameLine.toLowerCase();
                break;
              }
            }
          }
        }

        // 3. Procura pelos nomes conhecidos de módulos no bodyText
        if (!foundName) {
          for (const key of Object.keys(PROTHEUS_MODULE_MAP)) {
            const regex = new RegExp(`\\b${key}\\b`, "i");
            if (regex.test(bodyText)) {
              foundName = key;
              break;
            }
          }
        }

        if (foundName) {
          context.module = PROTHEUS_MODULE_MAP[foundName] || foundName.toUpperCase();
        }
      }

      context.session_id = "protheus-" + Date.now();
    } catch (err) {
      console.warn("Copilot Protheus: falha ao extrair contexto do DOM.", err);
    }

    return context;
  }

  function hasMinimumContext(context) {
    return !!(context.company || context.branch || context.user || context.module);
  }

  // 2. Usar Shadow DOM para isolamento visual
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
      <span>Copilot Protheus</span>
      <button id="copilot-close" type="button" aria-label="Fechar">✕</button>
    </div>
    <div id="copilot-body">
      <div id="copilot-waiting">Aguardando efetuar login no Protheus...</div>
      <iframe id="copilot-iframe" src="" title="Copilot Protheus" style="display:none;"></iframe>
    </div>
  `;
  shadow.appendChild(panel);

  window.addEventListener("message", (event) => {
    const iframe = shadow.querySelector("#copilot-iframe");
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (event.data?.type === "cprot-result-state") {
      panel.classList.toggle("results-open", Boolean(event.data.open));
    }
  });

  function updateWaitingMessage(message) {
    const waiting = shadow.querySelector("#copilot-waiting");
    if (waiting) waiting.textContent = message;
  }

  function buildIframeUrl(config, context) {
    const url = new URL(config.widgetUrl);
    url.searchParams.set("tenant_id", config.tenantId || "");
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
      tenant_id: currentConfig.tenantId || "",
      environment_code: currentConfig.environmentCode || "",
      company_code: context.company || "",
      company_id: context.company_id || "",
      branch: context.branch || "",
      user: context.user || currentConfig.username || "",
      module: context.module || "",
      profile: context.profile || "",
      session_id: context.session_id || ""
    };

    try {
      const targetOrigin = new URL(currentConfig.widgetUrl).origin;
      iframe.contentWindow.postMessage(
        { type: "cprot-context-update", payload },
        targetOrigin
      );
    } catch (err) {
      console.warn("Copilot Protheus: falha ao enviar contexto via postMessage.", err);
    }
  }

  function activateWidget(config) {
    const iframe = shadow.querySelector("#copilot-iframe");
    const waiting = shadow.querySelector("#copilot-waiting");
    const context = extractProtheusContext();

    const nextUrl = buildIframeUrl(config, context);

    if (iframe.dataset.src !== nextUrl) {
      iframe.dataset.src = nextUrl;
      iframe.src = nextUrl;
      iframeLoaded = false;
    }

    iframe.style.display = "block";
    waiting.style.display = "none";

    if (!iframeLoaded) {
      iframe.addEventListener(
        "load",
        () => {
          iframeLoaded = true;
          sendContextToIframe(context);
        },
        { once: true }
      );
    } else {
      sendContextToIframe(context);
    }

    isSessionReady = true;
  }

  function deactivateWidget() {
    isSessionReady = false;
    updateWaitingMessage("Aguardando efetuar login no Protheus...");
    const iframe = shadow.querySelector("#copilot-iframe");
    const waiting = shadow.querySelector("#copilot-waiting");
    if (iframe) iframe.style.display = "none";
    if (waiting) waiting.style.display = "block";
    
    // 3. Reiniciar polling ao deslogar
    if (!pollInterval && currentConfig) {
      startSessionPolling(currentConfig);
    }
  }

  function evaluateSession(config) {
    if (!config?.widgetUrl) return;

    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    activateWidget(config);
  }

  function startSessionPolling(config) {
    if (pollInterval) return;

    pollInterval = setInterval(() => {
      evaluateSession(config);
    }, 1500);
  }

  function startObserver(config) {
    if (observer) return;

    observer = new MutationObserver(() => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observerTimeout = setTimeout(() => {
        evaluateSession(config);
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function applyConfig(config) {
    currentConfig = config;
    if (!config?.widgetUrl) {
      updateWaitingMessage("Widget nao configurado.");
      return;
    }

    evaluateSession(config);
    startSessionPolling(config);
    startObserver(config);
  }

  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    if (chrome.runtime.lastError) {
      console.warn("Copilot Protheus: falha ao obter configuracao.", chrome.runtime.lastError.message);
      updateWaitingMessage("Falha ao carregar configuracao da extensao.");
      return;
    }
    applyConfig(config);
  });

  fab.addEventListener("click", () => {
    panel.style.display = "flex";
    fab.style.display = "none";

    if (currentConfig) {
      evaluateSession(currentConfig);
    }
  });

  shadow.querySelector("#copilot-close").addEventListener("click", () => {
    panel.style.display = "none";
    fab.style.display = "flex";
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_WIDGET") {
      const isOpen = panel.style.display === "flex";
      panel.style.display = isOpen ? "none" : "flex";
      fab.style.display = isOpen ? "flex" : "none";

      if (!isOpen && currentConfig) {
        evaluateSession(currentConfig);
      }
    }

    if (message.type === "RELOAD_WIDGET") {
      applyConfig(message.config);
    }
  });
})();
const DEFAULT_CONFIG = {
  tenantId: "",
  username: "",
  password: "",
  widgetUrl: "https://copilot.elitecorp.tec.br/",
  launchUrl: "https://copilot.elitecorp.tec.br/api/launch",
};

const CONTENT_SCRIPT_MATCH_PATTERNS = [
  "https://*.totvs.com.br/*",
  "https://copilot.elitecorp.tec.br/*",
];

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_CONFIG));
    const merged = { ...DEFAULT_CONFIG, ...existing };
    await chrome.storage.local.set(merged);
  }
});

function safeSendMessage(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(
        `Copilot Protheus: não foi possível comunicar com a aba ${tabId}. ` +
        `Motivo: ${chrome.runtime.lastError.message}. ` +
        `Provável causa: content-script não injetado neste domínio.`
      );
      if (callback) callback(null, chrome.runtime.lastError);
      return;
    }
    if (callback) callback(response, null);
  });
}

async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["widget.css"],
    });
    return true;
  } catch (err) {
    console.warn("Copilot Protheus: falha ao injetar content-script manualmente.", err);
    return false;
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-widget") {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;

    safeSendMessage(activeTab.id, { type: "TOGGLE_WIDGET" }, async (response, error) => {
      if (error) {
        const injected = await ensureContentScriptInjected(activeTab.id);
        if (injected) {
          safeSendMessage(activeTab.id, { type: "TOGGLE_WIDGET" });
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CONFIG") {
    chrome.storage.local.get(Object.keys(DEFAULT_CONFIG), (config) => {
      sendResponse(config);
    });
    return true;
  }

  if (message.type === "CONFIG_UPDATED") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.id || !tab.url) return;
        const matchesDomain = CONTENT_SCRIPT_MATCH_PATTERNS.some((pattern) => {
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
          return regex.test(tab.url);
        });
        if (matchesDomain) {
          safeSendMessage(tab.id, { type: "RELOAD_WIDGET", config: message.config });
        }
      });
    });
  }

  if (message.type === "TOGGLE_WIDGET_FROM_POPUP") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      safeSendMessage(tab.id, { type: "TOGGLE_WIDGET" }, async (response, error) => {
        if (error) {
          const injected = await ensureContentScriptInjected(tab.id);
          if (injected) {
            safeSendMessage(tab.id, { type: "TOGGLE_WIDGET" });
          } else {
            console.warn(
              "Copilot Protheus: este domínio não está habilitado no manifest.json " +
              "(content_scripts.matches). Verifique a URL da aba atual."
            );
          }
        }
      });
    });
  }

  if (message.type === "OPEN_PROTHEUS") {
    chrome.storage.local.get(["launchUrl", "tenantId"], (config) => {
      if (config.launchUrl) {
        const url = `${config.launchUrl}?tenant=${encodeURIComponent(config.tenantId || "")}`;
        chrome.tabs.create({ url });
      }
    });
  }
});
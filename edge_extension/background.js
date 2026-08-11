const DEFAULT_CONFIG = {
  tenantId: "",
  username: "",
  password: "",
  widgetUrl: "https://copilot.elitecorp.tec.br/",
  launchUrl: "https://copilot.elitecorp.tec.br/api/launch",
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_CONFIG));
    const merged = { ...DEFAULT_CONFIG, ...existing };
    await chrome.storage.local.set(merged);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-widget") {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_WIDGET" });
    }
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
    chrome.tabs.query({ url: "https://*.totvs.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "RELOAD_WIDGET", config: message.config });
      });
    });
  }

  if (message.type === "TOGGLE_WIDGET_FROM_POPUP") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_WIDGET" });
      }
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